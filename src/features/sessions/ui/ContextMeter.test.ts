// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ContextMeter } from "./ContextMeter";
import { setLanguage } from "../../../shared/i18n";

it("only auto-compacts once per high reading, waits for idle, and exposes real cache metrics", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  setLanguage("en");
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const compact = vi.fn(() => true);
  const render = (used: number, disabled: boolean) =>
    act(async () =>
      root.render(
        createElement(ContextMeter, {
          sessionId: "context-regression",
          usage: { used, window: 100 },
          metrics: { cacheHitPercent: 75, cacheReadTokens: 300 },
          onCompact: compact,
          compactDisabled: disabled,
        }),
      ),
    );
  try {
    await render(90, true);
    expect(compact).not.toHaveBeenCalled();
    await render(90, false);
    expect(compact).toHaveBeenCalledTimes(1);
    await render(90, false);
    expect(compact).toHaveBeenCalledTimes(1);
    await render(40, false);
    await render(90, false);
    expect(compact).toHaveBeenCalledTimes(2);
    await act(async () => container.querySelector("button")!.click());
    expect(document.body.textContent).toContain("Cache hit rate: 75.0%");
    const checkbox = document.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;
    await act(async () => checkbox.click());
    await render(95, false);
    expect(compact).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem("mycode.autoCompact")).toBe("false");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  }
});
