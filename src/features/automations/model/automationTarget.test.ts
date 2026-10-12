import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../sessions/model/session", () => ({ newDefaultSession: vi.fn() }));
import { newDefaultSession } from "../../sessions/model/session";
import { resolveAutomationTarget } from "./automationTarget";

const source = () => ({
  cwd: "/work/project",
  runtimeMode: "full-access" as const,
  harness: "claude" as const,
  model: "",
  modelSettings: {} as Record<string, string>,
});
beforeEach(() => vi.resetAllMocks());

it("preserves explicit choices and connection settings without consulting defaults", () => {
  const input = {
    ...source(),
    model: "claude:sonnet-5",
    modelSettings: { connectionId: "saved", effort: "high" },
  };
  expect(resolveAutomationTarget(input)).toEqual({
    harness: "claude",
    model: "claude:sonnet-5",
    modelSettings: input.modelSettings,
  });
  expect(newDefaultSession).not.toHaveBeenCalled();
});

it("resolves current project defaults anew for every followed run", () => {
  vi.mocked(newDefaultSession)
    .mockReturnValueOnce({
      harness: "codex",
      model: "codex:default",
      modelSettings: { effort: "high" },
    } as ReturnType<typeof newDefaultSession>)
    .mockReturnValueOnce({
      harness: "devin",
      model: "devin:adaptive",
      modelSettings: {},
    } as ReturnType<typeof newDefaultSession>);
  const input = { ...source(), model: "  " };
  expect(resolveAutomationTarget(input)).toEqual({
    harness: "codex",
    model: "codex:default",
    modelSettings: { effort: "high" },
  });
  expect(resolveAutomationTarget(input).harness).toBe("devin");
  expect(newDefaultSession).toHaveBeenNthCalledWith(
    1,
    "/work/project",
    "full-access",
  );
  expect(input.model).toBe("  ");
});

it("keeps legacy empty-model tasks with explicit connections on their original provider", () => {
  vi.mocked(newDefaultSession).mockReturnValue({
    harness: "pi",
    model: "pi:default",
    modelSettings: { effort: "medium", connectionId: "new" },
  } as ReturnType<typeof newDefaultSession>);
  const input = {
    ...source(),
    modelSettings: { connectionId: "saved", effort: "high" },
  };
  expect(resolveAutomationTarget(input)).toEqual({
    harness: "claude",
    model: "",
    modelSettings: { connectionId: "saved", effort: "high" },
  });
  expect(newDefaultSession).not.toHaveBeenCalled();
  expect(
    resolveAutomationTarget({ ...source(), modelSettings: { effort: "old" } })
      .modelSettings,
  ).toEqual({ connectionId: "new", effort: "medium" });
  expect(input.modelSettings).toEqual({
    connectionId: "saved",
    effort: "high",
  });
});
