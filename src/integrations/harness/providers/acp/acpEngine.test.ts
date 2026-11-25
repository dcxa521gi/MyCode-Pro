// @vitest-environment happy-dom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { SendTurnInput } from "../../core/types";
const wire = vi.hoisted(() => ({
  listener: undefined as undefined | ((line: string) => void),
  requests: [] as any[],
  spawn: vi.fn(),
  kill: vi.fn(),
  load: true,
  plan: true,
  requestPermission: false,
  resolve: vi.fn(),
  pending: undefined as any,
}));
vi.mock("../../core/child", () => ({
  watchChild: (_id: string, listener: (line: string) => void) => {
    wire.listener = listener;
  },
  spawnChild: wire.spawn,
  killChild: wire.kill,
  writeChild: async (_id: string, line: string) => {
    const message = JSON.parse(line);
    wire.requests.push(message);
    const reply = (result: unknown) =>
      wire.listener!(
        JSON.stringify({ jsonrpc: "2.0", id: message.id, result }),
      );
    if (message.method === "initialize")
      reply({
        protocolVersion: 1,
        agentCapabilities: { loadSession: wire.load },
        authMethods: [],
      });
    else if (
      message.method === "session/new" ||
      message.method === "session/load"
    )
      reply({
        sessionId: "opaque/provider:session/1",
        models: { currentModelId: "model-1" },
        modes: {
          availableModes: wire.plan ? [{ id: "plan", name: "Plan" }] : [],
        },
      });
    else if (message.method === "session/prompt" && wire.requestPermission) {
      wire.pending = message;
      wire.listener!(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "permission",
          method: "session/request_permission",
          params: {
            sessionId: "opaque/provider:session/1",
            toolCall: { toolCallId: "call", title: "Write file", kind: "edit" },
            options: [
              { optionId: "once", kind: "allow_once", name: "Allow" },
              { optionId: "always", kind: "allow_always", name: "Always" },
              { optionId: "deny", kind: "reject_once", name: "Deny" },
            ],
          },
        }),
      );
    } else if (message.id === "permission") {
      wire.listener!(
        JSON.stringify({
          jsonrpc: "2.0",
          id: wire.pending.id,
          result: { stopReason: "end_turn" },
        }),
      );
    } else if (message.method === "session/prompt") {
      wire.listener!(
        JSON.stringify({
          method: "session/update",
          params: {
            sessionId: "opaque/provider:session/1",
            update: {
              sessionUpdate: "agent_message_chunk",
              content: { type: "text", text: "已完成" },
            },
          },
        }),
      );
      reply({ stopReason: "end_turn" });
    } else if (message.method && message.id) reply({});
  },
}));
vi.mock("../../../../features/plugins/model/acpEngines", () => ({
  resolveAcpModel: wire.resolve,
  refreshAcpEngines: vi.fn(),
}));
vi.mock("../../core/registry", () => ({ registerHarness: vi.fn() }));
import { acpAdapter, sendAcpTurn, stopAcpEngine } from "./acpEngine";
function input(extra: Partial<SendTurnInput> = {}): SendTurnInput {
  return {
    sessionId: "acp-test",
    cwd: "D:/project",
    model: "acp:engine:account:model-1",
    runtimeMode: "supervised",
    text: "work",
    onEvent: vi.fn(),
    ...extra,
  };
}
beforeEach(() => {
  wire.requests = [];
  wire.plan = true;
  wire.load = true;
  wire.requestPermission = false;
  wire.spawn.mockReset().mockResolvedValue(1);
  wire.kill.mockReset().mockResolvedValue(undefined);
  wire.resolve
    .mockReset()
    .mockResolvedValue({
      id: "engine",
      accountId: "account",
      model: "model-1",
      engine: { revision: "approved", authMethodId: undefined },
    });
});
afterEach(async () => {
  await acpAdapter.forgetSession("acp-test");
});
it("streams a standard ACP turn, then resumes its opaque session without replaying the user prompt", async () => {
  const first = input();
  await sendAcpTurn(first);
  await stopAcpEngine(first.sessionId);
  await sendAcpTurn(input({ text: "next" }));
  expect(wire.requests.filter((r) => r.method === "session/new")).toHaveLength(
    1,
  );
  expect(
    wire.requests.find((r) => r.method === "session/load")?.params.sessionId,
  ).toBe("opaque/provider:session/1");
  expect(
    wire.requests.filter((r) => r.method === "session/prompt"),
  ).toHaveLength(2);
  expect(first.onEvent).toHaveBeenCalledWith({ type: "message.completed" });
  expect(wire.spawn.mock.calls[0][11]).toEqual({
    id: "engine",
    revision: "approved",
    accountId: "account",
  });
});
it("cannot resurrect a stopped task while resolving the engine", async () => {
  let release!: (route: unknown) => void;
  wire.resolve.mockReturnValueOnce(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const pending = sendAcpTurn(input());
  await stopAcpEngine("acp-test");
  release({
    id: "engine",
    accountId: "account",
    model: "model-1",
    engine: { revision: "approved" },
  });
  await pending;
  expect(wire.spawn).not.toHaveBeenCalled();
});
it("does not substitute a new session when loadSession is unsupported", async () => {
  acpAdapter.bindSession("acp-test", "saved", "D:/project");
  wire.load = false;
  await expect(sendAcpTurn(input())).rejects.toThrow(/resume|恢复/);
  expect(
    wire.requests.some(
      (r) => r.method === "session/new" || r.method === "session/prompt",
    ),
  ).toBe(false);
});
it("uses one-time permissions rather than granting permanent permission", async () => {
  wire.requestPermission = true;
  await sendAcpTurn(
    input({
      onEvent: (e) => {
        if (e.type === "approval.requested")
          acpAdapter.respondApproval("acp-test", e.requestId, "allow");
      },
    }),
  );
  expect(
    wire.requests.find((r) => r.id === "permission").result.outcome.optionId,
  ).toBe("once");
});
it("requires an advertised plan mode and denies writes inside planning", async () => {
  wire.plan = false;
  await expect(sendAcpTurn(input({ intent: "plan" }))).rejects.toThrow(
    /planning|规划/,
  );
  expect(wire.requests.some((r) => r.method === "session/prompt")).toBe(false);
  await acpAdapter.forgetSession("acp-test");
  wire.plan = true;
  wire.requestPermission = true;
  await sendAcpTurn(input({ intent: "plan" }));
  expect(
    wire.requests.find((r) => r.id === "permission").result.outcome.optionId,
  ).toBe("deny");
});
