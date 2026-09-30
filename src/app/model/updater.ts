import { getVersion } from "@tauri-apps/api/app";
import { message } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { translate as t } from "../../shared/i18n";
import { announceUpdateAvailable } from "../../features/settings/model/sounds";
import {
  compareVersions,
  fetchRelease,
  type GitHubRelease,
} from "./githubReleases";

export type UpdaterPhase =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";
export type UpdaterSnapshot = {
  phase: UpdaterPhase;
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  error?: string;
  notes?: string;
};
let pendingUpdate: GitHubRelease | null = null;
export async function readAppVersion(): Promise<string> {
  try {
    return await getVersion();
  } catch {
    return "0.0.0";
  }
}
export async function probeForUpdate(): Promise<GitHubRelease | null> {
  const [release, current] = await Promise.all([
    fetchRelease(),
    readAppVersion(),
  ]);
  pendingUpdate =
    compareVersions(release.version, current) > 0 ? release : null;
  if (pendingUpdate) announceUpdateAvailable(release.version);
  return pendingUpdate;
}
export async function runUpdateFlow(
  manual: boolean,
  onProgress?: (snapshot: UpdaterSnapshot) => void,
): Promise<UpdaterSnapshot> {
  const currentVersion = await readAppVersion();
  onProgress?.({ phase: "checking", currentVersion });
  try {
    const update = await probeForUpdate();
    const snapshot: UpdaterSnapshot = update
      ? { phase: "available", currentVersion, availableVersion: update.version }
      : { phase: "current", currentVersion };
    onProgress?.(snapshot);
    if (manual && !update)
      await message(t("You're on the latest version."), { title: "MyCode" });
    return snapshot;
  } catch (error) {
    pendingUpdate = null;
    const snapshot: UpdaterSnapshot = {
      phase: "error",
      currentVersion,
      error: `${t("Couldn't check for updates.")} ${String(error)}`,
    };
    onProgress?.(snapshot);
    return snapshot;
  }
}
export function skipPendingUpdate() {
  if (pendingUpdate)
    localStorage.setItem("mycode.skippedUpdate", pendingUpdate.version);
  window.dispatchEvent(
    new CustomEvent("mycode-update", {
      detail: { phase: "idle", currentVersion: "…" },
    }),
  );
}
export function isUpdateSkipped(version: string) {
  return localStorage.getItem("mycode.skippedUpdate") === version;
}
let download: Promise<UpdaterSnapshot> | null = null;
let downloadedVersion = "";
export async function launchPendingInstaller() {
  if (!pendingUpdate || downloadedVersion !== pendingUpdate.version)
    throw new Error(t("Download the update first"));
  await invoke("app_update_install", { version: pendingUpdate.version });
}
/** Download and verify only. Installation always requires a separate click. */
export function installPendingUpdate(
  onProgress?: (snapshot: UpdaterSnapshot) => void,
): Promise<UpdaterSnapshot> {
  if (download)
    return download.then((next) => {
      onProgress?.(next);
      return next;
    });
  download = (async () => {
    const currentVersion = await readAppVersion();
    if (!pendingUpdate) return { phase: "idle" as const, currentVersion };
    const version = pendingUpdate.version;
    const notes = pendingUpdate.body;
    const emit = (
      phase: UpdaterPhase,
      progress?: number,
      error?: string,
    ): UpdaterSnapshot => {
      const next = {
        phase,
        currentVersion,
        availableVersion: version,
        notes,
        progress,
        error,
      };
      onProgress?.(next);
      window.dispatchEvent(new CustomEvent("mycode-update", { detail: next }));
      return next;
    };
    if (downloadedVersion === version) return emit("downloaded", 100);
    let unlisten: (() => void) | undefined;
    try {
      emit("downloading", 0);
      unlisten = await listen<{ version: string; progress: number }>(
        "mycode-update-progress",
        (event) => {
          if (event.payload.version === version)
            emit("downloading", event.payload.progress);
        },
      );
      await invoke("app_update_download", { version });
      downloadedVersion = version;
      return emit("downloaded", 100);
    } catch (error) {
      return emit(
        "error",
        undefined,
        t("Update download failed.") + " " + String(error),
      );
    } finally {
      unlisten?.();
    }
  })().finally(() => {
    download = null;
  });
  return download;
}
