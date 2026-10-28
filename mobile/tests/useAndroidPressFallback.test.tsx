import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAndroidPressFallback } from "@/features/sessions/useAndroidPressFallback";

let root: Root;
let container: HTMLDivElement;
let api: ReturnType<typeof useAndroidPressFallback>;
const action = vi.fn();

function Probe({ enabled }: { enabled: boolean }) {
  api = useAndroidPressFallback(enabled, action);
  return null;
}

function render(enabled = true) {
  act(() => root.render(createElement(Probe, { enabled })));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  action.mockClear();
  container = document.createElement("div");
  root = createRoot(container);
  render();
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

it("fires once on a normal release", () => {
  act(() => { api.begin(10, 10); api.finish(); vi.advanceTimersByTime(600); });
  expect(action).toHaveBeenCalledOnce();
});

it("recovers a canceled Android press after the grace period without double sending", () => {
  act(() => api.begin(10, 10));
  act(() => vi.advanceTimersByTime(300));
  expect(action).toHaveBeenCalledOnce();
  act(() => api.finish());
  expect(action).toHaveBeenCalledOnce();
});

it("cancels a dragged press and a press disabled while pending", () => {
  act(() => { api.begin(10, 10); api.move(10, 30); api.finish(); });
  expect(action).not.toHaveBeenCalled();
  act(() => api.begin(10, 10));
  render(false);
  act(() => vi.advanceTimersByTime(600));
  expect(action).not.toHaveBeenCalled();
});

it("clears the pending press on unmount", () => {
  act(() => api.begin(10, 10));
  act(() => root.unmount());
  act(() => vi.advanceTimersByTime(600));
  expect(action).not.toHaveBeenCalled();
  root = createRoot(container);
});
