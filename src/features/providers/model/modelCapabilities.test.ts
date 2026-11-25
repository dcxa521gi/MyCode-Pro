import { expect, it } from "vitest";
import { modelCapabilities } from "./modelCapabilities";
it.each(["Magpie", "OpenRouter", "custom", "TokenDance", "local"])("classifies %s models from metadata without relying on a provider allowlist", (provider) => {
  expect(modelCapabilities(`${provider}/opaque-model`, { modalities: ["TEXT", "IMAGE", "VIDEO", "AUDIO"], outputModalities: ["TEXT", "IMAGE", "VIDEO", "AUDIO", "MUSIC", "EMBEDDING", "RERANKING"] }).map((t) => t.capability)).toEqual(["text", "vision", "image-generation", "video-understanding", "video-generation", "speech-recognition", "speech-generation", "music", "embedding", "reranking"]);
});
it("does not confuse media understanding with generation", () => {
  expect(modelCapabilities("opaque", { mode: "video-understanding" })).toEqual([{ capability: "video-understanding", evidence: "reported" }]);
  expect(modelCapabilities("opaque", { mode: "image_understanding" })).toEqual([{ capability: "vision", evidence: "reported" }]);
});
it("separates visual input from generated images for every provider", () => {
  expect(
    modelCapabilities("any/vendor", {
      modalities: ["text", "image"],
      outputModalities: ["text"],
    }),
  ).toEqual([
    { capability: "text", evidence: "reported" },
    { capability: "vision", evidence: "reported" },
  ]);
});
it("labels guesses without overriding authoritative output metadata", () => {
  expect(modelCapabilities("gpt-image-1")).toContainEqual({
    capability: "image-generation",
    evidence: "inferred",
  });
  expect(
    modelCapabilities("gpt-image-1", { outputModalities: ["text"] }),
  ).not.toContainEqual({
    capability: "image-generation",
    evidence: "inferred",
  });
  expect(modelCapabilities("vendor-unknown")).toEqual([]);
});
it("retains explicit manual corrections including an empty classification", () => {
  expect(
    modelCapabilities("gpt-image-1", { capabilityOverrides: ["music"] }),
  ).toEqual([{ capability: "music", evidence: "manual" }]);
  expect(modelCapabilities("gpt-image-1", { capabilityOverrides: [] })).toEqual(
    [],
  );
});
