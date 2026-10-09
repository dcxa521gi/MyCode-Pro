// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("../../../integrations/harness/core/child", () => ({
  inspectHarnessBinary: vi.fn(),
}));
vi.mock("../model/providerBinaryPaths", () => ({
  applyProviderBinaryPath: vi.fn(async () => true),
  loadProviderBinaryPath: () => null,
}));
vi.mock("../../../integrations/harness/core/availability", () => ({
  probeHarnessAvailability: vi.fn(async () => {}),
}));
vi.mock("../../../integrations/harness/providers/pi/piCatalog", () => ({
  refreshPiCatalog: vi.fn(async () => {}),
}));
import { invoke } from "@tauri-apps/api/core";
import { inspectHarnessBinary } from "../../../integrations/harness/core/child";
import {
  invalidateCLIVersion,
  checkCLIVersion,
  cliState,
} from "../model/cliVersions";
import { ManagedCLIControls } from "./ManagedCLIControls";
import { applyProviderBinaryPath } from "../model/providerBinaryPaths";
let root: Root,
  container: HTMLDivElement,
  installed: string | undefined,
  latest: string,
  offline: boolean;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  vi.clearAllMocks();
  installed = "1.0.0";
  latest = "1.0.0";
  offline = false;
  vi.mocked(inspectHarnessBinary).mockImplementation(async () => {
    if (!installed) throw Error("CLI not installed");
    return { path: "/cli/codex", version: installed };
  });
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "managed_cli_latest") {
      if (offline) throw Error("offline");
      return { version: latest };
    }
    if (command === "managed_cli_install") {
      installed = latest;
      return "/app/codex";
    }
    return null;
  });
  invalidateCLIVersion("codex");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => {
    root.render(createElement(ManagedCLIControls, { provider: "codex" }));
  });
  await act(async () => {
    await checkCLIVersion("codex");
  });
}
const button = (text: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === text,
  )!;
it("reflects an update notification's scope change while settings remain open", async () => {
  localStorage.setItem("mycode.cliScope.codex", "global");
  await render();
  expect(container.textContent).toContain("Global (this computer)");
  await act(async () => {
    window.dispatchEvent(new Event("mycode-cli-paths-changed"));
    localStorage.setItem("mycode.cliScope.codex", "app");
    await new Promise((resolve) => window.setTimeout(resolve, 10));
  });
  expect(container.textContent).toContain("MyCode app");
  expect(container.textContent).not.toContain("Global (this computer)");
});
it("installs missing CLIs, then shows a disabled current-version action", async () => {
  installed = undefined;
  await render();
  expect(button("Install").disabled).toBe(false);
  await act(async () => button("Install").click());
  expect(invoke).toHaveBeenCalledWith("managed_cli_install", {
    provider: "codex",
  });
  expect(button("No new version").disabled).toBe(true);
  expect(cliState("codex").installed).toBe(latest);
});
it("shows an update icon and directly updates an older installed CLI", async () => {
  latest = "1.1.0";
  await render();
  const update = button("Update");
  expect(update.disabled).toBe(false);
  expect(update.querySelector("svg")).not.toBeNull();
  await act(async () => update.click());
  expect(button("No new version").disabled).toBe(true);
});
it("keeps newer installed versions and does not offer a downgrade", async () => {
  installed = "2.0.0";
  await render();
  expect(button("No new version").disabled).toBe(true);
  expect(invoke).not.toHaveBeenCalledWith(
    "managed_cli_install",
    expect.anything(),
  );
});
it("does not treat failed release checks as no update and can retry", async () => {
  offline = true;
  await render();
  expect(button("No new version")).toBeUndefined();
  expect(button("Retry check").disabled).toBe(false);
  offline = false;
  latest = "1.1.0";
  await act(async () => button("Retry check").click());
  expect(button("Update").disabled).toBe(false);
});
it("does not activate an installed binary that fails version verification", async () => {
  latest = "1.1.0";
  await render();
  vi.mocked(inspectHarnessBinary).mockResolvedValueOnce({
    path: "/app/codex",
    error: "broken executable",
  });
  await act(async () => button("Update").click());
  expect(applyProviderBinaryPath).not.toHaveBeenCalled();
  expect(localStorage.getItem("mycode.appCliPath.codex")).toBeNull();
  expect(button("Update").disabled).toBe(false);
  expect(container.textContent).toContain("broken executable");
});
it("keeps the previous active path when the installed copy is still outdated", async () => {
  latest = "1.1.0";
  await render();
  vi.mocked(inspectHarnessBinary).mockResolvedValueOnce({
    path: "/app/codex",
    version: "1.0.0",
  });
  await act(async () => button("Update").click());
  expect(applyProviderBinaryPath).not.toHaveBeenCalled();
  expect(localStorage.getItem("mycode.appCliPath.codex")).toBeNull();
  expect(container.textContent).toContain("1.1.0");
});
