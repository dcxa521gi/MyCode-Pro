// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ContextMeter } from "./ContextMeter";
import { setLanguage } from "../../../shared/i18n";

afterEach(() => { setLanguage("en"); vi.unstubAllGlobals(); });

it.each(["en", "zh-CN"] as const)("shows a truly empty context ring in a new %s conversation", async language => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLanguage(language);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(ContextMeter, {empty: true})));
    expect(container.querySelector('circle[stroke-dasharray]')).toBeNull();
    expect(container.querySelector('button')?.getAttribute('aria-label')).toContain("0%");
  } finally { await act(async () => root.unmount()); }
});
