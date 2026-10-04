import { beforeEach, expect, it, vi } from "vitest";
import {
  mobileHistory,
  mobileModelChoice,
  mobileModels,
} from "./mobileSession";
import { newSession } from "../../sessions/model/session";
const fixture = vi.hoisted(() => ({
  available: new Set(["pi"]),
  hidden: [] as string[],
  models: [
    { id: "model-a", name: "Configured model", harness: "pi" },
    { id: "model-a", name: "Other CLI model", harness: "claude" },
  ],
}));
vi.mock("../../sessions/model/models", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../sessions/model/models")>()),
  allModels: () => fixture.models,
  isPickerProviderVisible: () => true,
}));
vi.mock("../../sessions/model/projectProviders", () => ({
  loadProjectProviderSettings: () => ({ hidden: fixture.hidden }),
}));
vi.mock("../../../integrations/harness/core/availabilityState", () => ({
  isHarnessAvailable: (h: string) => fixture.available.has(h),
}));
beforeEach(() => {
  fixture.available = new Set(["pi"]);
  fixture.hidden = [];
});
it("only exposes installed enabled models and rejects removed or wrong-harness choices", () => {
  expect(mobileModels("F:/project")).toHaveLength(1);
  expect(mobileModelChoice("F:/project", "model-a", "pi")?.name).toBe(
    "Configured model",
  );
  expect(mobileModelChoice("F:/project", "model-a", "claude")).toBeUndefined();
  expect(
    mobileModelChoice("F:/project", "removed-model", "pi"),
  ).toBeUndefined();
  fixture.hidden = ["pi"];
  expect(mobileModels("F:/project")).toEqual([]);
});
it("paginates public history without leaking internal or tool messages", () => {
  const session = newSession("F:/project", "pi", "model-a");
  session.blocks = Array.from({ length: 45 }, (_, i) => ({
    id: String(i),
    role: i % 2 ? "assistant" : "user",
    text: "message " + i,
    streaming: false,
  }));
  session.blocks.push({
    id: "private",
    role: "assistant",
    text: "private instructions",
    internal: true,
    streaming: false,
  });
  const latest = mobileHistory(session);
  expect(latest.messages).toHaveLength(30);
  expect(latest.history).toEqual({ before: 15, hasMore: true, total: 45 });
  const older = mobileHistory(session, latest.history.before);
  expect(older.messages.map((m) => m.id)).toEqual(
    Array.from({ length: 15 }, (_, i) => String(i)),
  );
  expect(older.history.hasMore).toBe(false);
  expect(JSON.stringify(latest)).not.toContain("private instructions");
});
