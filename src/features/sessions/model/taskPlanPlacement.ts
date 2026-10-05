import type { Block } from "./session";
import { legacyTaskListFromText } from "./taskList";
export const PLAN_POSITIONS = [
  "inline",
  "top-right",
  "bottom-right",
  "above-input",
] as const;
export type PlanPosition = (typeof PLAN_POSITIONS)[number];
const KEY = "mycode.taskPlanPosition";
const EVENT = "mycode:task-plan-position";
export function planPosition(): PlanPosition {
  const value = localStorage.getItem(KEY);
  return PLAN_POSITIONS.includes(value as PlanPosition)
    ? (value as PlanPosition)
    : "inline";
}
export function savePlanPosition(value: PlanPosition) {
  localStorage.setItem(KEY, value);
  window.dispatchEvent(new Event(EVENT));
}
export function subscribePlanPosition(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
export function latestTaskPlan(blocks: Block[]) {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    const items =
      block.role === "tasks"
        ? block.taskList?.items
        : block.role === "plan" && !block.orchestration
          ? legacyTaskListFromText(block.text)
          : null;
    if (items?.length)
      return { id: block.id, items, explanation: block.taskList?.explanation };
  }
  return null;
}
