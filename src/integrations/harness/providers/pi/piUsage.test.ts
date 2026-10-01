import { expect, it } from "vitest";
import { PiTurnUsage } from "./piUsage";
it("replaces streamed snapshots, accumulates tool-loop messages and resets per turn", () => {
  const usage = new PiTurnUsage();
  usage.startMessage();
  usage.update({ inputTokens: 100, outputTokens: 5 });
  expect(
    usage.update({ inputTokens: 100, outputTokens: 20 }).outputTokens,
  ).toBe(20);
  usage.startMessage();
  const total = usage.update({
    inputTokens: 150,
    outputTokens: 30,
    cacheReadTokens: 50,
    cacheHitPercent: 25,
  });
  expect(total.inputTokens).toBe(250);
  expect(total.outputTokens).toBe(50);
  expect(total.cacheReadTokens).toBe(50);
  expect(total.cacheHitPercent).toBeCloseTo(100 / 6);
  usage.reset();
  expect(usage.update({ inputTokens: 10 }).inputTokens).toBe(10);
});
