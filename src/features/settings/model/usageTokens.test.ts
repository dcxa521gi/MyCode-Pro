import { expect, it } from "vitest";
import { usageTokens } from "./usageTokens";

it("includes separately reported cache and avoids counting Codex cache twice", () => {
  const row = {
    inputTokens: 100,
    outputTokens: 20,
    cacheReadTokens: 300,
    cacheWriteTokens: 50,
  };
  expect(usageTokens({ ...row, harness: "opencode" })).toBe(470);
  expect(usageTokens({ ...row, harness: "pi" })).toBe(470);
  expect(usageTokens({ ...row, harness: "codex" })).toBe(170);
});
