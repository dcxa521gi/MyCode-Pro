import { expect, it, vi } from "vitest";
import type { HarnessAdapter } from "../../core/registry";
let adapter: HarnessAdapter;
let line: (value: string) => void;
const requests: any[] = [];
vi.mock("../../core/registry", () => ({
  registerHarness: (value: HarnessAdapter) => {
    adapter = value;
  },
}));
vi.mock("../../core/child", () => ({
  resolveHarnessBinary: async () => ({ path: "minimax" }),
  spawnChild: async () => undefined,
  killChild: async () => undefined,
  unwatchChild: () => undefined,
  watchChild: (_id: string, onLine: typeof line) => {
    line = onLine;
  },
  writeChild: async (_id: string, text: string) => {
    const request = JSON.parse(text);
    requests.push(request);
    if (request.id === undefined) return;
    queueMicrotask(() =>
      line(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result:
            request.method === "session/new"
              ? {
                  sessionId: "native-session",
                  modes: { availableModes: [{ id: "plan" }, { id: "build" }] },
                  models: { availableModels: [] },
                }
              : {},
        }),
      ),
    );
  },
}));
const { ensureMinimaxRegistered } = await import("./minimaxAdapter");
ensureMinimaxRegistered();
it("uses ACP plan mode and selects the requested provider model", async () => {
  await adapter.sendTurn({
    sessionId: "minimax-test",
    cwd: "/repo",
    model: "mycode-local/test",
    runtimeMode: "supervised",
    intent: "plan",
    text: "Summarize",
    onEvent: vi.fn(),
  });
  expect(
    requests.find((r) => r.method === "session/set_mode").params.modeId,
  ).toBe("plan");
  expect(
    requests.find((r) => r.method === "session/set_model").params.modelId,
  ).toBe("mycode-local/test");
  expect(
    requests.find((r) => r.method === "session/prompt").params.sessionId,
  ).toBe("native-session");
  await adapter.stopSession("minimax-test");
});
