// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  release: vi.fn(),
  version: vi.fn(),
  open: vi.fn(),
  invoke: vi.fn(),
  message: vi.fn(),
  announce: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: mocks.version }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: mocks.open }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ message: mocks.message }));
vi.mock("../../features/settings/model/sounds", () => ({
  announceUpdateAvailable: mocks.announce,
}));
vi.mock("./githubReleases", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./githubReleases")>()),
  fetchRelease: mocks.release,
}));
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.version.mockResolvedValue("0.5.0");
  mocks.open.mockResolvedValue(undefined);
  mocks.invoke.mockResolvedValue(undefined);
});
describe("fork release updates", () => {
  it("downloads and verifies in app, and requires a separate install call", async () => {
    mocks.release.mockResolvedValue({
      version: "0.10.0",
      url: "https://github.com/dcxa521gi/MyCode-Pro/releases/tag/v0.10.0",
    });
    const updater = await import("./updater");
    expect((await updater.runUpdateFlow(false)).phase).toBe("available");
    expect((await updater.installPendingUpdate()).currentVersion).toBe("0.5.0");
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalledWith("app_update_download", {
      version: "0.10.0",
    });
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "app_update_install",
      expect.anything(),
    );
    await updater.launchPendingInstaller();
    expect(mocks.invoke).toHaveBeenCalledWith("app_update_install", {
      version: "0.10.0",
    });
  });
  it("does not offer a downgrade", async () => {
    mocks.release.mockResolvedValue({ version: "0.4.0" });
    const updater = await import("./updater");
    expect(await updater.probeForUpdate()).toBeNull();
    expect((await updater.installPendingUpdate()).phase).toBe("idle");
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("reports a failed request and clears a previously pending release", async () => {
    mocks.release
      .mockResolvedValueOnce({ version: "0.6.0" })
      .mockRejectedValueOnce(new Error("offline"));
    const updater = await import("./updater");
    await updater.probeForUpdate();
    expect((await updater.runUpdateFlow(true)).phase).toBe("error");
    expect((await updater.installPendingUpdate()).phase).toBe("idle");
  });
});
