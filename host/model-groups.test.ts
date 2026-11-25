import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HostStore } from "./store";
import { HostEngine } from "./engine";
import { SharedModelGroups } from "./model-groups";
import type { ModelGroup } from "../src/features/providers/model/modelGroups";
import { setHarnessModels } from "../src/features/sessions/model/models";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const clean of cleanups.splice(0).reverse()) clean();
});
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "mycode-groups-"));
  const store = new HostStore(join(dir, "host.db"));
  cleanups.push(() => {
    store.close();
    rmSync(dir, { force: true, recursive: true });
  });
  const project = store.addProject(dir, "Project");
  const groups = new SharedModelGroups(store);
  const group: ModelGroup = {
    id: "pool",
    name: "Pool",
    harness: "codex",
    strategy: "rotate",
    exceptions: [],
    candidates: ["one", "two"].map((id) => ({
      id,
      model: `codex:${id}`,
      enabled: true,
      weight: 1,
    })),
  };
  setHarnessModels(
    "codex",
    group.candidates.map((c) => ({
      id: c.model,
      name: c.id,
      harness: "codex",
    })),
  );
  const revision = groups.publish(group, [project.id]);
  const engine = new HostEngine(store, {
    codex: {
      send: vi.fn(),
      cancel: vi.fn(),
      stop: vi.fn(),
      bind: vi.fn(),
      approve: vi.fn(),
      answer: vi.fn(),
    },
  });
  return { store, groups, group, engine, project, revision };
}
it("persists a group selection once per accepted create command, including retry receipts", () => {
  const { engine, project, revision, store } = setup();
  const command = {
    type: "create" as const,
    commandId: "first",
    projectId: project.id,
    harness: "codex" as const,
    model: `codex:group/pool/${revision}`,
    runtimeMode: "supervised" as const,
  };
  const first = engine.command(command);
  expect(engine.command(command)).toEqual(first);
  const second = engine.command({ ...command, commandId: "second" });
  expect(store.session(first.sessionId!).session.model).toBe("codex:one");
  expect(store.session(second.sessionId!).session.model).toBe("codex:two");
});
it("rejects stale revisions, unshared projects and revoked follow-up turns", () => {
  const { engine, project, revision, groups, store } = setup();
  const first = engine.command({
    type: "create",
    commandId: "first",
    projectId: project.id,
    harness: "codex",
    model: `codex:group/pool/${revision}`,
    runtimeMode: "supervised",
  });
  expect(() =>
    groups.resolve(project.id, "codex:group/pool/stale", "codex"),
  ).toThrow();
  expect(() =>
    groups.resolve("unshared", `codex:group/pool/${revision}`, "codex"),
  ).toThrow();
  const session = store.session(first.sessionId!).session;
  groups.authorize(project.id, session);
  groups.remove("pool");
  expect(() =>
    engine.command({
      type: "send",
      commandId: "next",
      sessionId: session.id,
      text: "continue",
    }),
  ).toThrow(/授权|access/);
  expect(store.session(session.id).session.blocks).toEqual([]);
});
it("does not accept client-side API connection IDs or missing named account credentials", () => {
  const { groups, group, project } = setup();
  expect(() =>
    groups.publish(
      {
        ...group,
        candidates: [
          { ...group.candidates[0], model: "codex:mycode-private/m" },
        ],
      },
      [project.id],
    ),
  ).toThrow();
  expect(() =>
    groups.publish(
      {
        ...group,
        candidates: [{ ...group.candidates[0], accountId: "../../secret" }],
      },
      [project.id],
    ),
  ).toThrow();
});
