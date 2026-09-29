import { afterEach, expect, it } from "vitest";
import {
  setConnectionModels,
  modelsFor,
  nativeModelId,
  preferredModelId,
  findModel,
  defaultSessionChoice,
} from "./models";
afterEach(() => setConnectionModels([]));
it("exposes provider models only through compatible protocols and prioritizes the primary", () => {
  setConnectionModels([
    {
      id: "a",
      name: "Local",
      baseUrl: "http://localhost:1234/v1",
      api: "openai-responses",
      models: ["test"],
      primaryModel: "test",
      enabled: true,
      hasKey: false,
    },
  ]);
  const model = modelsFor("codex").find((model) => model.connectionId === "a")!;
  expect(model).toBeDefined();
  expect(nativeModelId(model.id)).toBe("test");
  expect(preferredModelId("codex")).toBe(model.id);
  expect(findModel(defaultSessionChoice().model)?.primary).toBe(true);
  expect(
    modelsFor("mimo").some((model) => model.nativeId === "mycode-a/test"),
  ).toBe(true);
  expect(modelsFor("cursor").some((model) => model.connectionId)).toBe(false);
  expect(modelsFor("claude").some((model) => model.connectionId)).toBe(false);
  setConnectionModels([]);
  expect(findModel(model.id)).toBeUndefined();
});
it("keeps equal model names on separate providers distinct", () => {
  setConnectionModels(
    ["a", "b"].map((id) => ({
      id,
      name: id,
      baseUrl: "https://example.com",
      api: "anthropic-messages",
      models: ["test"],
      enabled: true,
      hasKey: true,
    })),
  );
  const models = modelsFor("claude").filter((model) => model.connectionId);
  expect(models).toHaveLength(2);
  expect(models[0].id).not.toBe(models[1].id);
  expect(modelsFor("codex").some((model) => model.connectionId)).toBe(false);
});
