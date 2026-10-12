import { setLanguage } from "../../../shared/i18n";
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MonoWorkStatus } from "../model/monoWorkStatus";
import { MonoWorkTicker } from "./MonoWorkTicker";

let root: Root;
let container: HTMLDivElement;
const running: MonoWorkStatus = {
  key: "command",
  label: "Running command…",
  kind: "run",
  active: true,
};
const thinking: MonoWorkStatus = {
  key: "note",
  label: "Thinking…",
  kind: "think",
  active: true,
};
const editing: MonoWorkStatus = {
  key: "edit",
  label: "Editing file…",
  kind: "edit",
  active: true,
};

beforeEach(() => {
  setLanguage("en");
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setLanguage("en");
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function render(status: MonoWorkStatus) {
  act(() => root.render(createElement(MonoWorkTicker, { status })));
}

function advance(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

it("pushes the old row upward with the new one below, then removes the old row", () => {
  render(running);
  render(thinking);
  expect(container.querySelector(".sr-only")?.textContent).toBe(running.label);
  advance(850);
  expect(container.querySelector('[data-moving="true"]')).not.toBeNull();
  expect(
    Array.from(container.querySelectorAll(".mono-work-ticker-row")).map(
      (row) => row.textContent,
    ),
  ).toEqual([running.label, thinking.label]);
  expect(container.querySelector(".sr-only")?.textContent).toBe(thinking.label);
  advance(340);
  expect(container.querySelectorAll(".mono-work-ticker-row")).toHaveLength(1);
  expect(container.querySelector('[data-moving="true"]')).toBeNull();
});

it("coalesces a burst into the latest activity without building an animation backlog", () => {
  render(running);
  render(thinking);
  advance(100);
  render(editing);
  advance(750);
  expect(container.querySelector(".sr-only")?.textContent).toBe(editing.label);
  expect(container.textContent).not.toContain(thinking.label);
  advance(340);
  expect(container.querySelectorAll(".mono-work-ticker-row")).toHaveLength(1);
});

it("ticks for another command with the same label, while streamed chunks remain steady", () => {
  render(running);
  advance(850);
  render({ ...running });
  expect(container.querySelector('[data-moving="true"]')).toBeNull();
  render({ ...running, key: "next-command" });
  expect(container.querySelectorAll(".mono-work-ticker-row")).toHaveLength(2);
  advance(340);
  expect(container.querySelectorAll(".mono-work-ticker-row")).toHaveLength(1);
});

it("changes immediately without a rolling animation when reduced motion is enabled", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  render(running);
  render(thinking);
  expect(container.querySelector(".sr-only")?.textContent).toBe(thinking.label);
  expect(container.querySelector('[data-moving="true"]')).toBeNull();
  expect(container.querySelectorAll(".mono-work-ticker-row")).toHaveLength(1);
});

it("switches the same status between languages without starting a tick", () => {
  render(running);
  const track = container.querySelector(".mono-work-ticker-track");
  act(() => setLanguage("zh-CN"));
  expect(container.querySelector(".sr-only")?.textContent).toBe(
    "正在运行命令…",
  );
  expect(container.querySelector(".mono-work-ticker-row")?.textContent).toBe(
    "正在运行命令…",
  );
  expect(container.querySelector(".mono-work-ticker-track")).toBe(track);
  expect(container.querySelector('[data-moving="true"]')).toBeNull();
  expect(running.label).toBe("Running command…");
  act(() => setLanguage("en"));
  expect(container.querySelector(".sr-only")?.textContent).toBe(running.label);
});

it("localizes pending questions and counted background tasks while mounted", () => {
  const waiting = {
    key: "background",
    label: "Waiting for 2 background tasks…",
    kind: "think",
    active: true,
  } as const;
  render(waiting);
  act(() => setLanguage("zh-CN"));
  expect(container.querySelector(".sr-only")?.textContent).toBe(
    "正在等待 2 个后台任务…",
  );
  act(() => setLanguage("en"));
  expect(container.querySelector(".sr-only")?.textContent).toBe(waiting.label);
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  render({ ...waiting, key: "question", label: "Waiting for answers…" });
  act(() => setLanguage("zh-CN"));
  expect(container.querySelector(".sr-only")?.textContent).toBe(
    "正在等待回答…",
  );
});

it("translates summary counters while preserving tool diagnostics and filenames", () => {
  act(() => setLanguage("zh-CN"));
  const summary = {
    key: "summary",
    label: "Read 3 files · Edited README.md · Ran a command · 2 notes",
    kind: "edit",
    active: false,
  } as const;
  render(summary);
  expect(container.querySelector(".sr-only")?.textContent).toBe(
    "已读取 3 个文件 · 已编辑 README.md · 已运行命令 · 2 条说明",
  );
  expect(container.querySelector(".mono-work-ticker-row")?.textContent).toBe(
    "已读取 3 个文件 · 已编辑 README.md · 已运行命令 · 2 条说明",
  );
  expect(summary.label).toBe(
    "Read 3 files · Edited README.md · Ran a command · 2 notes",
  );
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const diagnostic = {
    ...summary,
    key: "diagnostic",
    label:
      "Running user command: Permission denied for F:/My Project/input.txt",
  };
  render(diagnostic);
  expect(container.querySelector(".sr-only")?.textContent).toBe(
    diagnostic.label,
  );
});
