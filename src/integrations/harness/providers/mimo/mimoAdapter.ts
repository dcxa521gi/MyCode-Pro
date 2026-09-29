import { AcpClient } from "../../core/acp";
import { registerHarness, type HarnessAdapter } from "../../core/registry";
import {
  killChild,
  resolveHarnessBinary,
  spawnChild,
  watchChild,
  unwatchChild,
} from "../../core/child";
import {
  nativeModelId,
  setHarnessModels,
} from "../../../../features/sessions/model/models";
import {
  eventsFromAcpUpdate,
  permissionRequestFromAcp,
  permissionOptionId,
  grokPromptBlocks,
} from "../grok/grokProtocol";
import type {
  HarnessEvent,
  SendTurnInput,
  ApprovalDecision,
} from "../../core/types";
type Live = {
  acp: AcpClient;
  id: string;
  cwd: string;
  modes: string[];
  onEvent: (event: HarnessEvent) => void;
  approvals: Map<number, (decision: ApprovalDecision) => void>;
};
const live = new Map<string, Live>();
const resume = new Map<string, string>();
async function stop(id: string) {
  const state = live.get(id);
  live.delete(id);
  state?.approvals.forEach((resolve) => resolve("deny"));
  state?.acp.close();
  unwatchChild(id);
  await killChild(id);
}
async function send(input: SendTurnInput) {
  let state = live.get(input.sessionId);
  if (state && state.cwd !== input.cwd) {
    await stop(input.sessionId);
    state = undefined;
  }
  if (!state) {
    const { path } = await resolveHarnessBinary("mimo");
    const next: Live = {
      acp: null!,
      id: "",
      cwd: input.cwd,
      modes: [],
      onEvent: input.onEvent,
      approvals: new Map(),
    };
    const acp = new AcpClient(input.sessionId, {
      onNotification(method, params) {
        if (method === "session/update")
          eventsFromAcpUpdate(params).forEach(next.onEvent);
      },
      async onRequest(id, method, params) {
        if (method !== "session/request_permission") {
          await acp.respond(id, { error: "Unsupported client capability" });
          return;
        }
        const request = permissionRequestFromAcp(params);
        const decision = await new Promise<ApprovalDecision>((resolve) => {
          next.approvals.set(id, resolve);
          next.onEvent({
            type: "approval.requested",
            requestId: id,
            title: request.title,
            kind: request.kind,
            callId: request.callId,
            preview: request.preview,
          });
        });
        next.approvals.delete(id);
        const optionId = permissionOptionId(decision, request.optionIds);
        await acp.respond(id, {
          outcome: request.optionIds.includes(optionId)
            ? { outcome: "selected", optionId }
            : { outcome: "cancelled" },
        });
        next.onEvent({ type: "approval.resolved", requestId: id, decision });
      },
    });
    next.acp = acp;
    live.set(input.sessionId, next);
    watchChild(
      input.sessionId,
      (line) => acp.pushLine(line),
      (code) => {
        acp.close(Error(`MiMo Code exited (${code})`));
        live.delete(input.sessionId);
      },
    );
    try {
      await spawnChild(
        input.sessionId,
        path,
        ["acp"],
        input.cwd,
        undefined,
        "mimo",
      );
      await acp.request(
        "initialize",
        {
          protocolVersion: 1,
          clientCapabilities: {
            fs: { readTextFile: false, writeTextFile: false },
            terminal: false,
          },
          clientInfo: { name: "MyCode", version: "0.7.0" },
        },
        30_000,
      );
      const previous = resume.get(input.sessionId);
      const setup = await acp.request<any>(
        previous ? "session/load" : "session/new",
        {
          cwd: input.cwd,
          mcpServers: [],
          ...(previous ? { sessionId: previous } : {}),
        },
        60_000,
      );
      next.id = setup.sessionId;
      next.modes = (setup.modes?.availableModes ?? []).map(
        (mode: { id: string }) => mode.id,
      );
      if (!next.id) throw Error("MiMo Code did not return a session ID");
      resume.set(input.sessionId, next.id);
      input.onEvent({
        type: "session.providerBound",
        providerSessionId: next.id,
      });
      if (Array.isArray(setup.models?.availableModels))
        setHarnessModels(
          "mimo",
          setup.models.availableModels.map((m: any) => ({
            id: `mimo:${m.modelId}`,
            harness: "mimo",
            name: m.name ?? m.modelId,
            nativeId: m.modelId,
          })),
        );
      state = next;
    } catch (error) {
      await stop(input.sessionId);
      throw error;
    }
  }
  state.onEvent = input.onEvent;
  const modeId = input.intent === "plan" ? "plan" : "build";
  if (state.modes.includes(modeId))
    await state.acp.request(
      "session/set_mode",
      { sessionId: state.id, modeId },
      20_000,
    );
  const modelId = nativeModelId(input.model);
  if (modelId)
    await state.acp.request(
      "session/set_model",
      { sessionId: state.id, modelId },
      20_000,
    );
  input.onAccepted?.();
  input.onEvent({ type: "session.started" });
  await state.acp.request(
    "session/prompt",
    {
      sessionId: state.id,
      prompt: grokPromptBlocks(input.text, input.attachments),
    },
    30 * 60_000,
  );
  input.onEvent({ type: "message.completed" });
}
const adapter: HarnessAdapter = {
  id: "mimo",
  live: true,
  canSteer: false,
  sendTurn: send,
  async steerTurn() {
    throw Error("Wait for the current MiMo Code turn to finish.");
  },
  async cancelTurn(id) {
    const state = live.get(id);
    state?.approvals.forEach((resolve) => resolve("deny"));
    await state?.acp.notify("session/cancel", { sessionId: state.id });
  },
  respondApproval(id, request, decision) {
    live.get(id)?.approvals.get(request)?.(decision);
  },
  stopSession: stop,
  async forgetSession(id) {
    resume.delete(id);
    await stop(id);
  },
  bindSession(id, providerId) {
    resume.set(id, providerId);
  },
  async runTextPrompt(input) {
    input.signal?.throwIfAborted();
    const id = crypto.randomUUID();
    let text = "";
    const abort = () => {
      void stop(id);
    };
    input.signal?.addEventListener("abort", abort, { once: true });
    try {
      await send({
        ...input,
        sessionId: id,
        model: input.model ?? "mimo:default",
        runtimeMode: "supervised",
        text: input.prompt,
        onEvent(event) {
          if (event.type === "message.delta") text += event.text;
          if (event.type === "approval.requested")
            adapter.respondApproval(id, event.requestId, "deny");
        },
      });
      return text;
    } finally {
      input.signal?.removeEventListener("abort", abort);
      resume.delete(id);
      await stop(id);
    }
  },
};
export function ensureMimoRegistered() {
  registerHarness(adapter);
}
