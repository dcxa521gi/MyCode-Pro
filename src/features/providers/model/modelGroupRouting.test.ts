// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from "vitest";
import type { Session } from "../../sessions/model/session";
import { idleRateLimits } from "./rateLimits";
import { saveGroupConfig, type ModelGroup } from "./modelGroups";
const mock = vi.hoisted(() => ({
  limits: vi.fn(),
  exists: vi.fn(),
  models: vi.fn(),
}));
vi.mock("../../../integrations/harness/core/availabilityState", () => ({
  isHarnessAvailable: () => true,
}));
vi.mock("../../sessions/model/models", () => ({
  modelsFor: (...args: unknown[]) => mock.models(...args),
}));
vi.mock("./rateLimitsCache", () => ({
  getCachedRateLimits: (...args: unknown[]) => mock.limits(...args),
  loadRateLimits: vi.fn(),
}));
vi.mock("./providerAccounts", () => ({
  supportsProviderAccounts: () => true,
  providerAccountExists: (...args: unknown[]) => mock.exists(...args),
  selectedProviderAccountId: () => "project-profile",
}));
import { modelGroupFacts, prepareModelGroupRoute } from "./modelGroupRouting";
const group: ModelGroup = {
  id: "account-pool",
  name: "Accounts",
  harness: "codex",
  strategy: "headroom",
  exceptions: [],
  candidates: [
    {
      id: "work",
      model: "codex:test",
      accountId: "work",
      weight: 1,
      enabled: true,
    },
    {
      id: "personal",
      model: "codex:test",
      accountId: "personal",
      weight: 1,
      enabled: true,
    },
  ],
};
const session = {
  harness: "codex",
  model: "codex:test",
  cwd: "/project",
  blocks: [],
} as unknown as Session;
beforeEach(() => {
  localStorage.clear();
  mock.exists.mockReturnValue(true);
  mock.models.mockReturnValue([
    { id: "codex:test", name: "Test", harness: "codex" },
  ]);
  mock.limits.mockImplementation((_provider, id) => ({
    ...idleRateLimits("codex"),
    status: "ok",
    updatedAt: Date.now(),
    session: {
      usedPercent: id === "work" ? 100 : 10,
      windowMinutes: 300,
      resetsAt: Date.now() + 60_000,
    },
    weekly: {
      usedPercent: 30,
      windowMinutes: 10080,
      resetsAt: Date.now() + 60_000,
    },
  }));
  saveGroupConfig({
    version: 1,
    groups: [group],
    defaults: { codex: group.id },
  });
});
it("routes the first send to an available isolated account without modifying saved defaults", () => {
  const route = prepareModelGroupRoute(session);
  expect(route?.accountId).toBe("personal");
  expect(route?.model.id).toBe("codex:test");
  expect(session).not.toHaveProperty("providerAccountId");
  expect(
    prepareModelGroupRoute({ ...session, providerSessionId: "native-thread" }),
  ).toBeUndefined();
  expect(
    prepareModelGroupRoute({
      ...session,
      blocks: [{ role: "user", id: "old" }] as Session["blocks"],
    }),
  ).toBeUndefined();
});
it("does not silently switch to a removed account or treat an old snapshot as fresh quota", () => {
  mock.exists.mockImplementation((_provider, id) => id !== "personal");
  expect(() => prepareModelGroupRoute(session)).toThrow("No available source");
  mock.limits.mockReturnValue({
    ...idleRateLimits("codex"),
    status: "ok",
    updatedAt: Date.now() - 600_000,
    session: { usedPercent: 100, windowMinutes: 300, resetsAt: null },
  });
  expect(modelGroupFacts(group, "/project").work).toMatchObject({
    headroom: null,
    limited: false,
  });
});
it("does not attach subscription quota or an account profile to an API-key source", () => {
  mock.exists.mockReturnValue(false);
  mock.models.mockReturnValue([
    {
      id: "codex:test",
      name: "API",
      harness: "codex",
      connectionId: "api-connection",
    },
  ]);
  expect(modelGroupFacts(group, "/project").work).toMatchObject({
    headroom: null,
    limited: false,
  });
  expect(prepareModelGroupRoute(session)?.accountId).toBeUndefined();
});
