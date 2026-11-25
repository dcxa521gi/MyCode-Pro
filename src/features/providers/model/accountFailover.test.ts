// @vitest-environment happy-dom
import { expect, it } from "vitest";
import { AccountFailover } from "./accountFailover";
import type { ModelGroup, CandidateFact } from "./modelGroups";
import type { Session } from "../../sessions/model/session";

const group: ModelGroup = {
  id: "g",
  name: "Pool",
  harness: "codex",
  strategy: "order",
  exceptions: [],
  autoSwitchAccounts: true,
  candidates: ["a", "b", "c"].map((id) => ({
    id,
    model: "codex:m",
    accountId: id,
    enabled: true,
    weight: 1,
  })),
};
const facts = Object.fromEntries(
  group.candidates.map((c) => [
    c.id,
    { available: true, headroom: 80, limited: false },
  ]),
) as Record<string, CandidateFact>;
const session = () =>
  ({
    id: "s",
    cwd: "D:/project",
    harness: "codex",
    model: "codex:m",
    modelGroupId: "g",
    runtimeMode: "normal",
    providerSessionId: "native",
    providerAccountId: "a",
    busy: false,
    usageLimit: { resetsAt: null },
    blocks: [{ id: "turn1", role: "user", text: "work" }],
  }) as unknown as Session;
it("carries the same native conversation and never cycles through an account twice", () => {
  const pool = new AccountFailover();
  const s = session();
  const first = pool.begin(s, group, facts)!;
  expect(first.target).toBe("b");
  expect(first.valid(s, group)).toBe(true);
  expect(pool.begin(s, group, facts)).toBeUndefined();
  first.finish();
  const next = { ...s, providerAccountId: "b" };
  expect(pool.begin(next, group, facts)?.target).toBe("c");
});
it("pausing invalidates an in-flight transfer until a new real user turn", () => {
  const pool = new AccountFailover();
  const s = session();
  const attempt = pool.begin(s, group, facts)!;
  pool.stop(s.id);
  expect(attempt.valid(s, group)).toBe(false);
  attempt.finish();
  expect(pool.begin(s, group, facts)).toBeUndefined();
  expect(
    pool.begin(
      { ...s, blocks: [...s.blocks, { ...s.blocks[0], id: "next" }] },
      group,
      facts,
    )?.target,
  ).toBe("b");
});
it("honors a pause issued before the first quota notification", () => {
  const pool = new AccountFailover();
  pool.stop("s", "turn1");
  expect(pool.begin(session(), group, facts)).toBeUndefined();
});
it("rejects changed permissions, model, folder, group revision and native session", () => {
  const pool = new AccountFailover();
  const s = session();
  const attempt = pool.begin(s, group, facts)!;
  for (const change of [
    { runtimeMode: "full-access" },
    { model: "codex:other" },
    { cwd: "D:/other" },
    { providerSessionId: "other" },
  ])
    expect(attempt.valid({ ...s, ...change } as Session, group)).toBe(false);
  expect(attempt.valid(s, { ...group, autoSwitchAccounts: false })).toBe(false);
  expect(attempt.valid(s, undefined)).toBe(false);
});
it("never triggers on generic errors, API models, missing transcripts or an unapproved group", () => {
  for (const change of [
    { usageLimit: undefined },
    { providerSessionId: undefined },
    { modelGroupId: undefined },
    { busy: true },
  ])
    expect(
      new AccountFailover().begin({ ...session(), ...change }, group, facts),
    ).toBeUndefined();
  expect(
    new AccountFailover().begin(
      session(),
      { ...group, autoSwitchAccounts: false },
      facts,
    ),
  ).toBeUndefined();
  const exhausted = Object.fromEntries(
    Object.keys(facts).map((id) => [id, { ...facts[id], limited: true }]),
  );
  expect(
    new AccountFailover().begin(session(), group, exhausted),
  ).toBeUndefined();
});
it("does not reset its budget for internal continuations and permanently stops a failed transfer", () => {
  const pool = new AccountFailover();
  const s = session();
  const attempt = pool.begin(s, group, facts)!;
  attempt.fail();
  const continuation = {
    ...s,
    blocks: [...s.blocks, { ...s.blocks[0], id: "continue", internal: true }],
  };
  expect(pool.begin(continuation, group, facts)).toBeUndefined();
});
