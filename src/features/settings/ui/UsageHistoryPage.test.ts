// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { UsageHistoryPage } from "./UsageHistoryPage";
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => [
    ...["pi", "codex"].map((harness, index) => ({
      sessionId: harness,
      title: harness,
      harness,
      model: `Model-${harness}`,
      cwd: "/tmp",
      updatedAt: Date.now(),
      inputTokens: 100 + index,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      turns: 1,
      measuredTurns: 1,
    })),
  ]),
}));
vi.mock("../../../shared/i18n", () => {
  const t = (value: string) => value;
  return { useTranslation: () => ({ t, locale: "en" }) };
});
it("filters agent usage and charts using the selected actual agent value", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(createElement(UsageHistoryPage)));
    expect(host.querySelector("tbody")?.textContent).toContain("Model-pi");
    expect(host.querySelector("tbody")?.textContent).toContain("Model-codex");
    const pi = [
      ...host.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Agent"] button',
      ),
    ].find((b) => b.textContent === "pi")!;
    expect(pi).toBeTruthy();
    await act(async () => pi.click());
    expect(pi.getAttribute("aria-checked")).toBe("true");
    expect(host.querySelector("tbody")?.textContent).toContain("Model-pi");
    expect(host.querySelector("tbody")?.textContent).not.toContain(
      "Model-codex",
    );
    expect(host.querySelector('[title="pi · Model-pi: 120"]')).toBeTruthy();
  } finally {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
