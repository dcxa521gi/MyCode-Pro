// @vitest-environment happy-dom
import { beforeEach, expect, it } from "vitest";
import {
  latestTaskPlan,
  planPosition,
  savePlanPosition,
} from "./taskPlanPlacement";
import type { Block } from "./session";
beforeEach(() => localStorage.clear());
it("defaults to inline and ignores unknown persisted positions", () => {
  expect(planPosition()).toBe("inline");
  localStorage.setItem("mycode.taskPlanPosition", "unknown");
  expect(planPosition()).toBe("inline");
  savePlanPosition("above-input");
  expect(planPosition()).toBe("above-input");
});
it("uses the most recent real plan and preserves item statuses", () => {
  const blocks: Block[] = [
    {
      id: "old",
      role: "tasks",
      text: "",
      taskList: { items: [{ text: "old", status: "completed" }] },
    },
    { id: "legacy", role: "plan", text: "[x] ready\n[~] testing" },
    {
      id: "new",
      role: "tasks",
      text: "",
      taskList: { items: [{ text: "new", status: "in_progress" }] },
    },
  ];
  expect(latestTaskPlan(blocks)?.id).toBe("new");
  expect(latestTaskPlan(blocks.slice(0, 2))?.items[1].status).toBe(
    "in_progress",
  );
  expect(latestTaskPlan([])).toBeNull();
});
