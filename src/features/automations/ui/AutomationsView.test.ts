// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  listAutomations,
  newAutomationDraft,
  notifyAutomationsChanged,
  peekAutomations,
  type Automation,
} from "../model/automations";
import { AutomationsView } from "./AutomationsView";
import { setLanguage } from "../../../shared/i18n";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", async (original) => ({
  ...(await original<typeof import("@tauri-apps/api/core")>()),
  invoke,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isMaximized: async () => false,
    onResized: async () => () => {},
  }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  notifyAutomationsChanged();
  invoke.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("shows the cached automation list immediately and refreshes it without a loading screen", async () => {
  const automation: Automation = {
    ...newAutomationDraft("/work/project", "codex", "model"),
    id: "test-automation",
    name: "Daily review",
    nextRunAt: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  invoke.mockResolvedValue([automation]);
  await listAutomations();
  let finish!: (automations: Automation[]) => void;
  const refresh = new Promise<Automation[]>((resolve) => {
    finish = resolve;
  });
  invoke.mockReturnValue(refresh);
  await act(async () =>
    root.render(
      createElement(AutomationsView, {
        cwd: "/work/project",
        recents: [],
        onClose: vi.fn(),
        onLaunch: vi.fn(),
        onOpenSession: vi.fn(),
      }),
    ),
  );
  expect(
    container.querySelector('[aria-label="Open Daily review"]'),
  ).not.toBeNull();
  expect(container.querySelector(".animate-spin")).toBeNull();

  await act(async () => finish([{ ...automation, name: "Updated review" }]));
  expect(
    container.querySelector('[aria-label="Open Updated review"]'),
  ).not.toBeNull();
  expect(
    container.querySelector('[aria-label="Open Daily review"]'),
  ).toBeNull();
});

it("invalidates the cached list when an automation changes", async () => {
  invoke.mockResolvedValue([]);
  await listAutomations();
  expect(peekAutomations()).toEqual([]);
  notifyAutomationsChanged();
  expect(peekAutomations()).toBeNull();
});

it("saves followed defaults with no old connection and can return to a concrete default", async () => {
  let stored: Automation = {
    ...newAutomationDraft("/work/project", "codex", "codex:default"),
    modelSettings: { connectionId: "old-connection" },
    id: "follow-default-test",
    name: "Follow test",
    prompt: "Review the project",
    nextRunAt: 0,
    createdAt: 1,
    updatedAt: 1,
  };
  invoke.mockImplementation(async (command, args) => {
    if (command === "automations_list") return [stored];
    if (command === "automations_upsert") {
      stored = { ...stored, ...args.automation };
      return stored;
    }
    return [];
  });
  await listAutomations();
  await act(async () =>
    root.render(
      createElement(AutomationsView, {
        cwd: "/work/project",
        recents: [],
        onClose: vi.fn(),
        onLaunch: vi.fn(),
        onOpenSession: vi.fn(),
      }),
    ),
  );
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[aria-label="Open Follow test"]')!
      .click(),
  );
  const follow = () =>
    [...container.querySelectorAll("label")]
      .find((label) =>
        label.textContent?.includes("Follow new conversation defaults"),
      )!
      .querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  expect(follow().checked).toBe(false);
  await act(async () => follow().click());
  expect(follow().checked).toBe(true);
  const save = () =>
    container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  expect(save().disabled).toBe(false);
  await act(async () => save().click());
  expect(stored.model).toBe("");
  expect(stored.modelSettings).toEqual({});
  expect(stored.id).toBe("follow-default-test");
  await act(async () => follow().click());
  expect(follow().checked).toBe(false);
  await act(async () => save().click());
  expect(stored.model.trim()).not.toBe("");
  expect(stored.modelSettings?.connectionId).not.toBe("old-connection");
});
