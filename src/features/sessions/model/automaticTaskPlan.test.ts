import { describe, expect, it } from "vitest";
import { taskListFromPlanText } from "./taskList";
import {
  appendUser,
  applyHarnessEvent,
} from "../../../integrations/harness/core/apply";
import { newSession } from "./session";

describe("automatic task plans", () => {
  it("reads Chinese and English plans with explicit completion only", () => {
    expect(
      taskListFromPlanText("## 任务计划\n1、检查项目\n2、修复问题"),
    ).toEqual([
      { text: "检查项目", status: "pending" },
      { text: "修复问题", status: "pending" },
    ]);
    expect(
      taskListFromPlanText(
        "Task plan:\n- [x] Inspect\n- [~] Implement\n- [ ] Verify\n- [-] Cancelled",
      )?.map((i) => i.status),
    ).toEqual(["completed", "in_progress", "pending", "cancelled"]);
  });
  it("does not mistake ordinary lists, quoted plans or code examples for actual tasks", () => {
    for (const text of [
      "1. A\n2. B",
      "```md\n## Plan\n- [x] A\n```",
      "> ## Plan\n> - [x] A",
      "## Results\n- [x] A",
    ])
      expect(taskListFromPlanText(text)).toBeNull();
  });
  it("updates one persisted table and never completes tasks on cancellation or turn finish", () => {
    let session = appendUser(newSession("claude", "/tmp"), "Implement");
    const say = (text: string) => {
      session = applyHarnessEvent(session, { type: "message.delta", text });
      session = applyHarnessEvent(session, { type: "message.completed" });
    };
    say("## 任务计划\n- [ ] Inspect\n- [ ] Verify");
    say("## 任务计划\n- [x] Inspect\n- [ ] Verify");
    expect(session.blocks.filter((b) => b.role === "tasks")).toHaveLength(1);
    expect(
      session.blocks
        .find((b) => b.role === "tasks")
        ?.taskList?.items.map((i) => i.status),
    ).toEqual(["completed", "pending"]);
    session = applyHarnessEvent(session, { type: "session.ended", code: 0 });
    expect(
      session.blocks.find((b) => b.role === "tasks")?.taskList?.items[1].status,
    ).toBe("pending");
  });
  it("lets native task events replace the fallback and prevents duplicate tables", () => {
    let session = appendUser(newSession("claude", "/tmp"), "Implement");
    session = applyHarnessEvent(session, {
      type: "message.delta",
      text: "## Plan\n- [ ] Inspect",
    });
    session = applyHarnessEvent(session, { type: "message.completed" });
    session = applyHarnessEvent(session, {
      type: "tasks.updated",
      items: [{ text: "Native task", status: "in_progress" }],
    });
    session = applyHarnessEvent(session, {
      type: "message.delta",
      text: "## Plan\n- [x] Inspect",
    });
    session = applyHarnessEvent(session, { type: "message.completed" });
    expect(session.blocks.filter((b) => b.role === "tasks")).toHaveLength(1);
    expect(
      session.blocks.find((b) => b.role === "tasks")?.taskList?.items[0].text,
    ).toBe("Native task");
  });
});
