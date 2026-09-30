import { beforeEach, expect, it, vi } from "vitest";
const invoke = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
import { connectGroupRunner, groupPrompt, replyOrder, runGroup, saveGroup, getGroups, type Group, type Member } from "./groups";
const member = (name: string, manager = false): Member => ({ id: name, name, manager, role: "Research", personality: "Careful", gender: "", harness: "codex", model: "codex:default" });
const group = (): Group => ({ id: crypto.randomUUID(), name: "Team", cwd: "D:/team", members: [member("A"), member("B"), member("Lead", true)], memory: "Only this team's notes", messages: [], idle: false, minSeconds: 30, maxSeconds: 60, tokenLimit: 1000, tokens: 0 });
beforeEach(() => { invoke.mockClear(); });
it("answers mentions first, includes every participant, and keeps the manager last", () => {
  expect(replyOrder(group(), "@B please review", false).map(m => m.name)).toEqual(["B", "A", "Lead"]);
  expect(replyOrder(group(), "hello", true, () => 0.99).map(m => m.name)).toEqual(["B"]);
});
it("keeps the prompt scoped to the supplied group history and memory", () => {
  const one = group(), two = group(); two.memory = "Private other group";
  const prompt = groupPrompt(one, one.members[0], false, false);
  expect(prompt).toContain(one.memory); expect(prompt).not.toContain(two.memory);
  expect(prompt).toContain("Do not modify files");
});
it("runs real adapter turns in order and persists their usage", async () => {
  const g = group(); await saveGroup(g);
  const runner = vi.fn(async () => ({ text: "Answer", tokens: 25 })); connectGroupRunner(runner);
  await runGroup(g.id, "Question");
  expect(runner.mock.calls).toHaveLength(3);
  const saved = getGroups().find(x => x.id === g.id)!;
  expect(saved.tokens).toBe(75); expect(saved.messages.map(m => m.name)).toEqual(["You", "A", "B", "Lead"]);
});
it("never starts idle chat by default and stops before the next turn when budget is reached", async () => {
  const g = group(); g.tokenLimit = 10; await saveGroup(g);
  const runner = vi.fn(async () => ({ text: "Answer", tokens: 12 })); connectGroupRunner(runner);
  await runGroup(g.id, "", true); expect(runner).not.toHaveBeenCalled();
  await runGroup(g.id, "Question"); expect(runner).toHaveBeenCalledTimes(1);
});
it("pauses automatic chat if the provider does not report usage", async () => {
  const g = group(); g.idle = true; await saveGroup(g);
  connectGroupRunner(async () => ({ text: "Unmetered response" }));
  await runGroup(g.id, "", true);
  expect(getGroups().find(x => x.id === g.id)?.idle).toBe(false);
});
it("explicit execution goes only to the manager", async () => {
  const g = group(); await saveGroup(g);
  const names: string[] = [];
  connectGroupRunner(async turn => { names.push(turn.member.name); return { text: "Done", tokens: 1 }; });
  await runGroup(g.id, "Implement the approved task", false, true);
  expect(names).toEqual(["Lead"]);
});
