import { beforeEach, expect, it, vi } from "vitest";
import type { HarnessAdapter } from "../../core/registry";
let adapter: HarnessAdapter;
let line: (value: string) => void;
let exit: (code: number) => void;
const spawn = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock("../../core/registry", () => ({
  registerHarness: (value: HarnessAdapter) => {
    adapter = value;
  },
}));
vi.mock("../../core/child", () => ({
  resolveHarnessBinary: async () => ({ path: "zcode" }),
  spawnChild: (...args: unknown[]) => spawn(...args),
  killChild: async () => undefined,
  unwatchChild: () => undefined,
  watchChild: (_id: string, onLine: typeof line, onExit: typeof exit) => {
    line = onLine;
    exit = onExit;
  },
}));
const { ensureZcodeRegistered } = await import("./zcodeAdapter");
ensureZcodeRegistered();
beforeEach(() => spawn.mockClear());
const input = (sessionId: string, onEvent = vi.fn()) => ({
  sessionId,
  cwd: "/repo",
  model: "zcode:default",
  runtimeMode: "supervised" as const,
  text: "Hello",
  onEvent,
});
it("reads the final headless result and resumes the provider session", async () => {
  const events = vi.fn();
  const turn = adapter.sendTurn(input("one", events));
  await vi.waitFor(() => expect(spawn).toHaveBeenCalled());
  line(
    JSON.stringify({
      type: "result",
      sessionId: "provider-one",
      response: "Hello back",
      usage: { inputTokens: 8, outputTokens: 2 },
    }),
  );
  exit(0);
  await turn;
  expect(events).toHaveBeenCalledWith({
    type: "message.delta",
    text: "Hello back",
  });
  expect(events).toHaveBeenCalledWith({
    type: "turn.metrics",
    inputTokens: 8,
    outputTokens: 2,
  });
  spawn.mockClear();
  const second = adapter.sendTurn(input("one"));
  await vi.waitFor(() => expect(spawn).toHaveBeenCalled());
  expect(spawn.mock.calls[0][2]).toContain("--resume");
  await adapter.cancelTurn("one");
  await second;
});
it("settles a cancelled turn even when killing the child removes its exit listener", async () => {
  const turn = adapter.sendTurn(input("cancel"));
  await vi.waitFor(() => expect(spawn).toHaveBeenCalled());
  await adapter.cancelTurn("cancel");
  await turn;
});
