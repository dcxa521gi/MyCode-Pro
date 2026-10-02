import { expect, it } from "vitest";
import { newSession } from "./session";
import { importedContextPrompt } from "./importedContext";
import { setConnectionModels, modelsFor } from "./models";
it("seeds portable imported history without duplicating resumable native conversations", () => {
  const session = {
    ...newSession("claude", "/work"),
    id: "import-test",
    blocks: [
      {
        id: "import-test-0",
        role: "user" as const,
        text: "Prepare the annual report",
      },
    ],
  };
  expect(importedContextPrompt(session, "Continue")).toContain("annual report");
  expect(
    importedContextPrompt(
      { ...session, providerSessionId: "native" },
      "Continue",
    ),
  ).toBe("Continue");
  expect(importedContextPrompt({ ...session, id: "regular" }, "Continue")).toBe(
    "Continue",
  );
});
it("carries visible history into an isolated custom-model restart and excludes hidden reasoning", () => {
  setConnectionModels([
    {
      id: "context",
      name: "QA",
      baseUrl: "https://example.com/v1",
      api: "openai-completions",
      models: ["model"],
      enabled: true,
      hasKey: true,
    },
  ]);
  try {
    const session = {
      ...newSession("hermes", "/repo"),
      model: modelsFor("hermes").find((m) => m.connectionId === "context")!.id,
      blocks: [
        { id: "u", role: "user" as const, text: "Keep the existing report" },
        { id: "r", role: "reasoning" as const, text: "private reasoning" },
      ],
    };
    const prompt = importedContextPrompt(session, "Continue");
    expect(prompt).toContain("Keep the existing report");
    expect(prompt).not.toContain("private reasoning");
    expect(prompt).toContain("Current request:\nContinue");
    expect(
      importedContextPrompt(
        { ...session, providerSessionId: "native" },
        "Continue",
      ),
    ).toBe("Continue");
  } finally {
    setConnectionModels([]);
  }
});
