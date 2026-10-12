// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountUsageMeters, UsageMeter } from "./ProviderAccountUsage";
import { setLanguage } from "../../../shared/i18n";
import { parseDevinUsage } from "../model/rateLimits";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setLanguage("en");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
  vi.unstubAllGlobals();
  setLanguage("en");
});

it("switches Devin daily quota and extra balance labels between both languages", async () => {
  await act(async () =>
    root.render(
      createElement(AccountUsageMeters, {
        now: Date.now(),
        limits: parseDevinUsage({
          dailyRemainingPercent: 75,
          extraUsageBalanceMicros: -1_670_000,
        }),
      }),
    ),
  );
  expect(container.textContent).toContain("Daily");
  expect(container.textContent).toContain("Extra");
  expect(container.textContent).toContain("$-1.67");
  await act(async () => setLanguage("zh-CN"));
  expect(container.textContent).toContain("每日");
  expect(container.textContent).toContain("额外用量");
  expect(container.textContent).not.toContain("Daily");
  expect(container.textContent).toContain("$-1.67");
  await act(async () => setLanguage("en"));
  expect(container.textContent).toContain("Daily");
});

it("flips the meter when another window turns on remaining usage", async () => {
  const now = Date.now();
  await act(async () =>
    root.render(
      createElement(UsageMeter, {
        title: "5h",
        now,
        window: {
          usedPercent: 23,
          windowMinutes: 300,
          resetsAt: now + 3_600_000,
        },
      }),
    ),
  );
  const bar = () => container.querySelector('[role="progressbar"]');
  expect(bar()?.getAttribute("aria-label")).toBe("5h limit used");
  expect(bar()?.querySelector("span")?.getAttribute("style")).toBe(
    "width: 23%;",
  );

  await act(async () => {
    localStorage.setItem("monocode.showRemainingUsage", "1");
    window.dispatchEvent(
      new StorageEvent("storage", { key: "monocode.showRemainingUsage" }),
    );
  });

  expect(bar()?.getAttribute("aria-label")).toBe("5h limit remaining");
  expect(bar()?.querySelector("span")?.getAttribute("style")).toBe(
    "width: 77%;",
  );
  expect(container.textContent).toContain("77% left");
});
