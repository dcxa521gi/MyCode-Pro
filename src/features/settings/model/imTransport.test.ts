import { expect, it, vi } from "vitest";
import {
  chunkDiscordText,
  chunkDiscordFinalText,
} from "../../../../vendor/cindy-im/src/discord/chunk";
import { sendChunked } from "../../../../vendor/cindy-im/src/discord/outbound";
it("delivers the body after whitespace-only Discord chunks", async () => {
  const send = vi.fn(async () => ({ id: "reply" }));
  await sendChunked({ id: "channel", send }, "\n".repeat(2100) + "任务已完成");
  expect(send).toHaveBeenCalled();
  for (const [text] of send.mock.calls as unknown as [string][])
    expect(text.trim()).not.toBe("");
  expect(
    chunkDiscordFinalText("\n".repeat(2100) + "任务已完成").join(""),
  ).toContain("任务已完成");
});
it("does not break emoji surrogate pairs across message boundaries", () => {
  const text = "🧑".repeat(1500);
  const chunks = chunkDiscordText(text, 1999);
  expect(chunks.join("")).toBe(text);
  for (const chunk of chunks) {
    expect(chunk.length).toBeLessThanOrEqual(1999);
    expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]|[\uD800-\uDBFF]$/);
  }
  expect(chunkDiscordFinalText("   \n")).toEqual([]);
});
