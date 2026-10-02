import { expect, it, vi } from "vitest";
import { completionMessage, loadIMCompletion } from "./imCompletion";
it("defaults off and rejects unknown notification channels", () => {
  vi.stubGlobal("localStorage", {
    getItem: () =>
      '{"channels":["feishu","cloud","unknown"],"remoteContinue":true}',
  });
  expect(loadIMCompletion()).toEqual({
    channels: ["feishu"],
    remoteContinue: true,
  });
  vi.unstubAllGlobals();
  expect(loadIMCompletion()).toEqual({ channels: [], remoteContinue: false });
});
it("includes an explicit original-session continuation command and bounds the summary", () => {
  const text = completionMessage(
    "Demo",
    "Task",
    "session-a",
    "x".repeat(10000),
    true,
    true,
  );
  expect(text).toContain("项目：Demo");
  expect(text).toContain("/continue session-a");
  expect(text.length).toBeLessThan(3400);
  expect(
    completionMessage("Demo", "Task", "session-a", "done", false, false),
  ).not.toContain("/continue");
});
