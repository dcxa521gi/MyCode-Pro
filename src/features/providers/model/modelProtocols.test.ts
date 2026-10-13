import { expect, it } from "vitest";
import { reportedProtocols, supportsProtocol } from "./modelProtocols";
it("normalizes actual advertisements instead of guessing from model names", () => {
  const metadata = {
    name: "Claude vision",
    supportedProtocols: ["openai:chat-completions", "openai-completions"],
  };
  expect(reportedProtocols(metadata)).toEqual(["openai-completions"]);
  expect(supportsProtocol(metadata, "anthropic-messages")).toBe(false);
  expect(
    supportsProtocol(
      { protocols: ["openai:responses"], nativeApi: "anthropic-messages" },
      "anthropic-messages",
    ),
  ).toBe(false);
  expect(
    supportsProtocol(
      { supportedProtocols: ["vendor:future"], nativeApi: "openai-responses" },
      "openai-completions",
    ),
  ).toBe(false);
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

it("refuses to route explicit speech capabilities through a chat protocol", () => {
  expect(
    supportsProtocol(
      { mode: "audio_speech", nativeApi: "openai-audio-speech" } as never,
      "openai-responses",
    ),
  ).toBe(false);
  expect(
    supportsProtocol(
      { nativeApi: "openai-audio-speech" } as never,
      "openai-completions",
    ),
  ).toBe(false);
  expect(
    supportsProtocol(
      { nativeApi: "openai-responses" } as never,
      "openai-completions",
    ),
  ).toBe(false);
});

it("uses client protocols before backend native API", () => {
  const metadata = {
    supportedProtocols: ["openai:responses"],
    nativeApi: "anthropic-messages",
  };
  expect(reportedProtocols(metadata)).toEqual(["openai-responses"]);
  expect(supportsProtocol(metadata, "anthropic-messages")).toBe(false);
  expect(
    supportsProtocol(
      {
        supportedProtocols: ["openai:responses"],
        nativeApi: "openai-audio-speech",
      },
      "openai-responses",
    ),
  ).toBe(true);
  expect(
    supportsProtocol({ ...metadata, mode: "speech" }, "openai-responses"),
  ).toBe(false);
});

it("rejects explicitly nontext output but permits unknown and mixed outputs", () => {
  expect(
    supportsProtocol(
      { outputModalities: ["audio"] } as never,
      "openai-completions",
    ),
  ).toBe(false);
  expect(
    supportsProtocol(
      { output_modalities: ["image"] } as never,
      "openai-completions",
    ),
  ).toBe(false);
  expect(
    supportsProtocol(
      { model_info: { output_modalities: ["audio"] } } as never,
      "openai-completions",
    ),
  ).toBe(false);
  expect(
    supportsProtocol(
      { outputModalities: ["text", "audio"] } as never,
      "openai-completions",
    ),
  ).toBe(true);
  expect(
    supportsProtocol(
      { outputModalities: ["vendor:future"] } as never,
      "openai-completions",
    ),
  ).toBe(true);
});

it("keeps malformed unknown output capability values compatible", () => {
  expect(
    supportsProtocol({ outputModalities: [42] } as never, "openai-completions"),
  ).toBe(true);
});
