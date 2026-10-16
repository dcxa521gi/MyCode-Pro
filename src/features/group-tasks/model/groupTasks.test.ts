import { beforeEach, expect, it, vi } from "vitest";
import {
  connectTeamRunner,
  createTeamRoom,
  getTeamRooms,
  proposeTeamPlan,
  replyOrder,
  runNextTeamStep,
  type TeamRoom,
} from "./groupTasks";

const invoke = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const room = (): TeamRoom => ({
  kind: "mycode-group-task-v1",
  id: crypto.randomUUID(),
  name: "Project team",
  cwd: "F:/project",
  members: [
    {
      id: "builder",
      name: "Builder",
      role: "Developer",
      personality: "Careful",
      harness: "codex",
      model: "test",
      manager: false,
    },
    {
      id: "lead",
      name: "Lead",
      role: "Manager",
      personality: "Direct",
      harness: "claude",
      model: "test",
      manager: true,
    },
  ],
  memory: "Project-only",
  posts: [],
  plans: [],
  tokenLimit: 10000,
  tokensUsed: 0,
});

beforeEach(() => {
  invoke.mockClear();
  connectTeamRunner(undefined);
});

it("keeps discussion on the mentioned agent before the manager", () => {
  const order = replyOrder(room(), "@Builder review this");
  expect(order.map((agent) => agent.id)).toEqual(["builder", "lead"]);
});

it("requires separate approval for each real agent step and preserves the chosen folder", async () => {
  const item = room();
  await createTeamRoom(item);
  const calls: Array<{ agent: string; execute: boolean; cwd: string }> = [];
  connectTeamRunner(async ({ agent, execute, room: active }) => {
    calls.push({ agent: agent.id, execute, cwd: active.cwd });
    if (!execute)
      return {
        text: JSON.stringify({
          title: "Build feature",
          steps: [
            { title: "Implement", agentId: "builder" },
            { title: "Review", agentId: "lead" },
          ],
        }),
        tokens: 20,
      };
    return { text: `${agent.name} completed`, tokens: 30 };
  });
  await proposeTeamPlan(item.id, "Build feature");
  expect(
    getTeamRooms().find((entry) => entry.id === item.id)?.plans[0].status,
  ).toBe("proposed");
  expect(calls).toEqual([{ agent: "lead", execute: false, cwd: "F:/project" }]);
  const planId = getTeamRooms().find((entry) => entry.id === item.id)!.plans[0]
    .id;
  await runNextTeamStep(item.id, planId);
  const waiting = getTeamRooms().find((entry) => entry.id === item.id)!
    .plans[0];
  expect(waiting.status).toBe("waiting");
  expect(waiting.steps.map((step) => step.status)).toEqual(["done", "pending"]);
  expect(calls).toHaveLength(2);
  await runNextTeamStep(item.id, planId);
  expect(
    getTeamRooms().find((entry) => entry.id === item.id)!.plans[0].status,
  ).toBe("done");
  expect(calls.map((call) => call.agent)).toEqual(["lead", "builder", "lead"]);
  expect(invoke).toHaveBeenCalledWith("group_tasks_save", {
    room: expect.objectContaining({ id: item.id, cwd: "F:/project" }),
  });
  expect(invoke).not.toHaveBeenCalledWith("groups_save", expect.anything());
});
