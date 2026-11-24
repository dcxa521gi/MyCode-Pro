// @vitest-environment happy-dom
import { beforeEach, expect, it } from "vitest";
import {
  commitGroupPick,
  groupFingerprint,
  groupStrategyAt,
  loadGroupConfig,
  pickGroup,
  readGroupCursor,
  saveGroupConfig,
  validateGroup,
  type ModelGroup,
  type CandidateFact,
} from "./modelGroups";
const group = (): ModelGroup => ({
  id: "group",
  name: "Pool",
  harness: "codex",
  strategy: "weighted",
  exceptions: [],
  candidates: ["a", "b"].map((id, index) => ({
    id,
    model: `codex:${id}`,
    weight: index ? 1 : 3,
    enabled: true,
  })),
});
const facts: Record<string, CandidateFact> = {
  a: { available: true, limited: false, headroom: 20 },
  b: { available: true, limited: false, headroom: 80 },
};
beforeEach(() => localStorage.clear());
it("distributes 3:1 smoothly and records only accepted choices", () => {
  const g = group();
  saveGroupConfig({ version: 1, groups: [g], defaults: { codex: g.id } });
  expect(pickGroup(g, facts, readGroupCursor(g))?.candidate.id).toBe("a");
  expect(readGroupCursor(g).last).toBeUndefined();
  const picks = Array.from({ length: 8 }, () => {
    const pick = pickGroup(g, facts, readGroupCursor(g))!;
    commitGroupPick(g, pick);
    return pick.candidate.id;
  });
  expect(picks.filter((id) => id === "a")).toHaveLength(6);
  expect(picks.slice(0, 4)).toEqual(["a", "a", "b", "a"]);
});
it("stays on the active account until exhausted, then skips disabled or removed sources", () => {
  const g = { ...group(), strategy: "drain" as const };
  const cursor = { fingerprint: groupFingerprint(g), last: "b", counters: {} };
  expect(pickGroup(g, facts, cursor)?.candidate.id).toBe("b");
  expect(
    pickGroup(g, { ...facts, b: { ...facts.b, limited: true } }, cursor)
      ?.candidate.id,
  ).toBe("a");
  expect(
    pickGroup(
      g,
      { a: { ...facts.a, available: false }, b: { ...facts.b, limited: true } },
      cursor,
    ),
  ).toBeNull();
});
it("uses a known remaining quota before an unknown quota and resets weights after edits", () => {
  const g = { ...group(), strategy: "headroom" as const };
  expect(
    pickGroup(
      g,
      { ...facts, a: { ...facts.a, headroom: null } },
      readGroupCursor(g),
    )?.candidate.id,
  ).toBe("b");
  const changed = group();
  changed.candidates[1].weight = 10;
  expect(
    pickGroup(changed, facts, {
      fingerprint: groupFingerprint(group()),
      counters: { a: 10000, b: -10000 },
    })?.candidate.id,
  ).toBe("b");
});
it("applies overnight rules to the starting weekday, with exclusive end times", () => {
  const g = group();
  g.exceptions = [
    { days: [1], start: "22:00", end: "06:00", strategy: "drain" },
  ];
  expect(groupStrategyAt(g, new Date(2026, 10, 23, 23))).toBe("drain");
  expect(groupStrategyAt(g, new Date(2026, 10, 24, 5))).toBe("drain");
  expect(groupStrategyAt(g, new Date(2026, 10, 24, 6))).toBe("weighted");
  expect(groupStrategyAt(g, new Date(2026, 10, 25, 5))).toBe("weighted");
});
it("rejects retired agents and malformed ranges, preserving the saved configuration", () => {
  const g = group();
  saveGroupConfig({ version: 1, groups: [g], defaults: {} });
  expect(() => validateGroup({ ...g, harness: "minimax" })).toThrow();
  expect(() =>
    saveGroupConfig({
      version: 1,
      defaults: {},
      groups: [
        {
          ...g,
          exceptions: [
            { days: [], start: "25:00", end: "09:00", strategy: "drain" },
          ],
        },
      ],
    }),
  ).toThrow();
  expect(loadGroupConfig().groups[0]).toEqual(g);
});
