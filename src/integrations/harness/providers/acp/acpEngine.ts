import { JsonRpcClient, type JsonRpcId } from "../../core/jsonRpc";
import { killChild, spawnChild, watchChild } from "../../core/child";
import { registerHarness, type HarnessAdapter } from "../../core/registry";
import type { ApprovalDecision, SendTurnInput } from "../../core/types";
import { promptBlocks } from "../../../../features/sessions/model/attachments";
import {
  resolveAcpModel,
  refreshAcpEngines,
} from "../../../../features/plugins/model/acpEngines";
import {
  asRecord,
  eventsFromAcpUpdate,
  permissionRequestFromAcp,
  permissionOptionId,
  sessionIdFromResult,
  readConfigOptions,
  extractModelConfigId,
  modelsFromSessionNew,
} from "../antigravity/antigravityProtocol";
import { translate as t } from "../../../../shared/i18n";

type Live = {
  rpc: JsonRpcClient;
  session?: string;
  key: string;
  input: SendTurnInput;
  cancelled: boolean;
  running: boolean;
  replaying: boolean;
  approvals: Map<number, (decision: ApprovalDecision) => void>;
};
const lives = new Map<string, Live>();
const resumes = new Map<string, { id: string; cwd: string; owner?: string }>();
let sequence = 0;
const generations = new Map<string, number>();
async function permission(live: Live, id: JsonRpcId, params: unknown) {
  const request = permissionRequestFromAcp(params);
  let choice: string | null = null;
  if (live.running && !live.cancelled && !live.replaying) {
    if (live.input.intent === "plan") {
      choice = permissionOptionId(
        request.kind === "read" || request.kind === "search" ? "allow" : "deny",
        request.optionIds,
        request.optionKinds,
      );
    } else if (live.input.runtimeMode === "full-access") {
      choice = permissionOptionId(
        "allow",
        request.optionIds,
        request.optionKinds,
      );
    } else {
      const requestId = ++sequence;
      const answer = new Promise<ApprovalDecision>((resolve) =>
        live.approvals.set(requestId, resolve),
      );
      live.input.onEvent({
        type: "approval.requested",
        requestId,
        title: request.title,
        kind: request.kind,
        callId: request.callId,
        preview: request.preview,
      });
      const decision = await answer;
      live.approvals.delete(requestId);
      live.input.onEvent({ type: "approval.resolved", requestId, decision });
      choice =
        decision === "allow"
          ? (request.optionIds.find(
              (key) => request.optionKinds[key] === "allow_once",
            ) ?? null)
          : permissionOptionId("deny", request.optionIds, request.optionKinds);
    }
  }
  await live.rpc.respond(id, {
    outcome:
      choice && !live.cancelled
        ? { outcome: "selected", optionId: choice }
        : { outcome: "cancelled" },
  });
}
export async function stopAcpEngine(id: string) {
  generations.set(id, (generations.get(id) ?? 0) + 1);
  const live = lives.get(id);
  if (live) {
    live.cancelled = true;
    for (const resolve of live.approvals.values()) resolve("deny");
    live.approvals.clear();
    live.rpc.close(Error(t("ACP engine stopped")));
    lives.delete(id);
  }
  await killChild(id);
}
export async function sendAcpTurn(input: SendTurnInput): Promise<void> {
  const generation = generations.get(input.sessionId) ?? 0;
  const route = await resolveAcpModel(input.model);
  if ((generations.get(input.sessionId) ?? 0) !== generation) return;
  const owner = `${route.id}:${route.accountId}`;
  const key = `${owner}:${route.engine.revision}:${input.cwd}:${input.model}:${input.runtimeMode}:${input.intent}`;
  let live = lives.get(input.sessionId);
  if (live && (live.key !== key || live.rpc.isClosed)) {
    await stopAcpEngine(input.sessionId);
    live = undefined;
  }
  if (!live) {
    const rpc = new JsonRpcClient(
      input.sessionId,
      {
        onNotification: (method, params) => {
          const current = lives.get(input.sessionId);
          if (
            method !== "session/update" ||
            !current ||
            current.rpc !== rpc ||
            current.cancelled ||
            current.replaying
          )
            return;
          const incoming = asRecord(params)?.sessionId;
          if (current.session && incoming !== current.session) return;
          for (const event of eventsFromAcpUpdate(params))
            current.input.onEvent(event);
        },
        onRequest: async (id, method, params) => {
          const current = lives.get(input.sessionId);
          if (
            current?.rpc === rpc &&
            method === "session/request_permission" &&
            asRecord(params)?.sessionId === current.session
          )
            await permission(current, id, params);
          else
            await rpc.respondError(id, {
              code: -32601,
              message: t("ACP capability is not available"),
            });
        },
      },
      { label: "acp-plugin" },
    );
    live = {
      rpc,
      key,
      input,
      cancelled: false,
      running: false,
      replaying: false,
      approvals: new Map(),
    };
    lives.set(input.sessionId, live);
    const starting = live;
    watchChild(
      input.sessionId,
      (line) => rpc.pushLine(line),
      (code) => {
        starting.cancelled = true;
        rpc.close(Error(t("ACP engine exited")));
        for (const resolve of starting.approvals.values()) resolve("deny");
        if (lives.get(input.sessionId) === starting)
          lives.delete(input.sessionId);
        input.onEvent({ type: "session.ended", code });
      },
    );
    try {
      await spawnChild(
        input.sessionId,
        "",
        [],
        input.cwd,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          id: route.id,
          revision: route.engine.revision,
          accountId: route.accountId,
        },
      );
      if (starting.cancelled) {
        await killChild(input.sessionId);
        return;
      }
      const initialized = asRecord(
        await rpc.request(
          "initialize",
          {
            protocolVersion: 1,
            clientInfo: { name: "MyCode", version: "0.26.0" },
            clientCapabilities: {
              fs: { readTextFile: false, writeTextFile: false },
              terminal: false,
            },
          },
          30_000,
        ),
      );
      if (initialized?.protocolVersion !== 1)
        throw Error(t("This engine does not support ACP protocol version 1"));
      if (route.engine.authMethodId) {
        const methods = initialized.authMethods;
        if (
          !Array.isArray(methods) ||
          !methods.some((m) => asRecord(m)?.id === route.engine.authMethodId)
        )
          throw Error(
            t("The configured ACP authentication method is unavailable"),
          );
        await rpc.request(
          "authenticate",
          { methodId: route.engine.authMethodId },
          300_000,
        );
      }
      const saved = resumes.get(input.sessionId);
      if (saved?.owner && saved.owner !== owner)
        throw Error(
          t("Create a new conversation to change ACP engine accounts"),
        );
      if (saved && saved.cwd !== input.cwd)
        throw Error(t("ACP conversation belongs to a different folder"));
      if (
        saved &&
        asRecord(initialized.agentCapabilities)?.loadSession !== true
      )
        throw Error(t("This ACP engine cannot resume saved conversations"));
      starting.replaying = !!saved;
      const setup = await rpc.request(
        saved ? "session/load" : "session/new",
        {
          ...(saved ? { sessionId: saved.id } : {}),
          cwd: input.cwd,
          mcpServers: [],
        },
        60_000,
      );
      starting.replaying = false;
      const session = sessionIdFromResult(setup) ?? saved?.id;
      if (!session) throw Error(t("ACP engine did not return a session ID"));
      starting.session = session;
      resumes.set(input.sessionId, { id: session, cwd: input.cwd, owner });
      input.onEvent({
        type: "session.providerBound",
        providerSessionId: session,
      });
      input.onEvent({ type: "session.started" });
      // Select only advertised modes. Unadvertised modes are never assumed to bypass permissions.
      const modes = asRecord(asRecord(setup)?.modes);
      const availableModes = Array.isArray(modes?.availableModes)
        ? modes.availableModes
        : [];
      const requested =
        input.intent === "plan"
          ? "plan"
          : input.runtimeMode === "full-access"
            ? "bypassPermissions"
            : "default";
      const selected = availableModes.find(
        (m) =>
          String(asRecord(m)?.id).toLowerCase().replace(/[-_]/g, "") ===
          requested.toLowerCase(),
      );
      if (input.intent === "plan" && !selected)
        throw Error(t("This ACP engine has no read-only planning mode"));
      if (selected)
        await rpc.request(
          "session/set_mode",
          { sessionId: session, modeId: asRecord(selected)?.id },
          20_000,
        );
      const options = readConfigOptions(asRecord(setup)?.configOptions);
      const modelOption = options.find(
        (o) => o.id === extractModelConfigId(options),
      );
      if (modelOption)
        await rpc.request(
          "session/set_config_option",
          { sessionId: session, configId: modelOption.id, value: route.model },
          20_000,
        );
      else {
        const models = asRecord(asRecord(setup)?.models);
        if (models?.currentModelId !== route.model)
          await rpc.request(
            "session/set_model",
            { sessionId: session, modelId: route.model },
            20_000,
          );
      }
    } catch (error) {
      await stopAcpEngine(input.sessionId);
      throw error;
    }
  }
  live.input = input;
  if (live.cancelled) return;
  live.running = true;
  try {
    input.onAccepted?.();
    await live.rpc.request(
      "session/prompt",
      {
        sessionId: live.session,
        prompt: promptBlocks(input.text, input.attachments),
      },
      30 * 60_000,
    );
    if (!live.cancelled) input.onEvent({ type: "message.completed" });
  } finally {
    live.running = false;
    for (const resolve of live.approvals.values()) resolve("deny");
  }
}
export const acpAdapter: HarnessAdapter = {
  id: "acp",
  live: true,
  canSteer: false,
  sendTurn: sendAcpTurn,
  steerTurn: async () => {
    throw Error(t("This ACP engine does not support steering"));
  },
  cancelTurn: async (id) => {
    const live = lives.get(id);
    if (live?.session)
      await live.rpc.notify("session/cancel", { sessionId: live.session });
    await stopAcpEngine(id);
  },
  stopSession: stopAcpEngine,
  forgetSession: async (id) => {
    await stopAcpEngine(id);
    resumes.delete(id);
  },
  bindSession: (id, providerSessionId, cwd) => {
    resumes.set(id, { id: providerSessionId, cwd });
  },
  respondApproval: (id, request, decision) => {
    lives.get(id)?.approvals.get(request)?.(decision);
  },
  refreshCatalog: async () => {
    await refreshAcpEngines();
  },
};
export function ensureAcpRegistered() {
  registerHarness(acpAdapter);
}

/** No prompt is sent while discovering authentication methods and live models. */
export async function inspectAcpEngine(
  engine: import("../../../../features/plugins/model/acpEngines").AcpEngine,
  accountId: string,
  cwd: string,
) {
  const id = `acp-inspect-${crypto.randomUUID()}`;
  const rpc: JsonRpcClient = new JsonRpcClient(
    id,
    {
      onRequest: (requestId): Promise<void> =>
        rpc.respondError(requestId, {
          code: -32601,
          message: "Discovery does not grant tool access",
        }),
    },
    { label: "acp-inspect" },
  );
  watchChild(
    id,
    (line) => rpc.pushLine(line),
    () => rpc.close(Error(t("ACP engine exited"))),
  );
  try {
    await spawnChild(
      id,
      "",
      [],
      cwd,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { id: engine.id, revision: engine.revision, accountId },
    );
    const init = asRecord(
      await rpc.request(
        "initialize",
        {
          protocolVersion: 1,
          clientInfo: { name: "MyCode", version: "0.26.0" },
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false,
          },
        },
        30_000,
      ),
    );
    if (init?.protocolVersion !== 1)
      throw Error(t("This engine does not support ACP protocol version 1"));
    const authMethods = Array.isArray(init.authMethods)
      ? init.authMethods.flatMap((m) => {
          const rec = asRecord(m);
          return typeof rec?.id === "string"
            ? [{ id: rec.id, name: String(rec.name ?? rec.id) }]
            : [];
        })
      : [];
    if (engine.authMethodId)
      await rpc.request(
        "authenticate",
        { methodId: engine.authMethodId },
        300_000,
      );
    try {
      const setup = await rpc.request(
        "session/new",
        { cwd, mcpServers: [] },
        60_000,
      );
      return {
        authMethods,
        models: modelsFromSessionNew(setup).map((m) => ({
          id: m.nativeId ?? m.id.slice("antigravity:".length),
          name: m.name,
        })),
        error: "",
      };
    } catch (error) {
      return { authMethods, models: [], error: String(error) };
    }
  } finally {
    rpc.close();
    await killChild(id);
  }
}
