import { expect, it } from "vitest";
import { reportedProtocols, supportsProtocol } from "./modelProtocols";
it("normalizes actual advertisements instead of guessing from model names", () => {
  const metadata = {
    name: "Claude vision",
    supportedProtocols: ["openai:chat-completions", "openai-completions"],
  };
  expect(reportedProtocols(metadata)).toEqual(["openai-completions"]);
  expect(supportsProtocol(metadata, "anthropic-messages")).toBe(false);
  expect(supportsProtocol(metadata, "openai-completions")).toBe(true);
  expect(supportsProtocol({ name: "Claude vision" }, "openai-responses")).toBe(
    true,
  );
});
it("unknown advertisements do not silently remove valid models", () => {
  expect(
    supportsProtocol(
      { supportedProtocols: ["vendor:future"] },
      "openai-completions",
    ),
  ).toBe(true);
});
