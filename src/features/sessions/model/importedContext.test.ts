import { expect, it } from "vitest";
import { newSession } from "./session";
import { importedContextPrompt } from "./importedContext";
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
