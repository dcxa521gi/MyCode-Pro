// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { setLanguage } from "../../../shared/i18n";
const install = vi.hoisted(() => vi.fn(async () => "/app/codex"));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: install,
  isTauri: () => true,
}));
vi.mock("../../../integrations/harness/core/child", () => ({
  inspectHarnessBinary: vi.fn(async () => ({
    path: "/app/codex",
    version: "1.1.0",
  })),
}));
vi.mock("../model/providerBinaryPaths", () => ({
  applyProviderBinaryPath: vi.fn(async () => true),
}));
vi.mock("../../../integrations/harness/core/availability", () => ({
  probeHarnessAvailability: vi.fn(async () => undefined),
}));
vi.mock("../../../integrations/harness/core/registry", () => ({
  refreshHarnessCatalogs: vi.fn(async () => undefined),
}));
vi.mock("../model/harnessUpdates", () => ({
  announceHarnessUpdated: vi.fn(async () => undefined),
}));
vi.mock("../model/cliVersions", () => ({ invalidateCLIVersion: vi.fn() }));
import { CliReadyDialog } from "./CliReadyDialog";
afterEach(() => {
  setLanguage("en");
  vi.unstubAllGlobals();
});
it("keeps only missing-CLI installation, translates its title, and ignores installed/retired events", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  setLanguage("en");
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(createElement(CliReadyDialog, { sessions: [] })),
  );
  const installed = vi.fn();
  act(() =>
    window.dispatchEvent(
      new CustomEvent("mycode:cli-check", {
        detail: {
          provider: "codex",
          installed: "1.0.0",
          latest: "2.0.0",
          finish: installed,
        },
      }),
    ),
  );
  expect(installed).toHaveBeenCalledWith(true);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  act(() =>
    window.dispatchEvent(
      new CustomEvent("mycode:cli-check", {
        detail: { provider: "freebuff", finish: vi.fn() },
      }),
    ),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  const ready = vi.fn();
  act(() =>
    window.dispatchEvent(
      new CustomEvent("mycode:cli-check", {
        detail: { provider: "codex", finish: ready },
      }),
    ),
  );
  expect(document.querySelector('[aria-label="Install CLI"]')).not.toBeNull();
  expect(document.body.textContent).not.toContain("Update now");
  expect(document.body.textContent).not.toContain("Use installed version");
  await act(async () => setLanguage("zh-CN"));
  expect(document.querySelector('[aria-label="安装 CLI"]')).not.toBeNull();
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "立即安装")!
      .click(),
  );
  expect(install).toHaveBeenCalledWith("managed_cli_install", {
    provider: "codex",
  });
  await act(async () =>
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent === "继续")!
      .click(),
  );
  expect(ready).toHaveBeenCalledWith(true);
  act(() => root.unmount());
});
