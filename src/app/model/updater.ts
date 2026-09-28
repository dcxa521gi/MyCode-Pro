import { getVersion } from "@tauri-apps/api/app";
import { message } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { translate as t } from "../../shared/i18n";
import { announceUpdateAvailable } from "../../features/settings/model/sounds";
import {
  compareVersions,
  fetchRelease,
  type GitHubRelease,
} from "./githubReleases";

export type UpdaterPhase =
  "idle" | "checking" | "current" | "available" | "downloading" | "error";
export type UpdaterSnapshot = {
  phase: UpdaterPhase;
  currentVersion: string;
  availableVersion?: string;
  progress?: number;
  error?: string;
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
/** Opening a release page is not a successful installation. */
export async function installPendingUpdate(
  onProgress?: (snapshot: UpdaterSnapshot) => void,
): Promise<UpdaterSnapshot> {
  const currentVersion = await readAppVersion();
  if (!pendingUpdate) return { phase: "idle", currentVersion };
  const snapshot: UpdaterSnapshot = {
    phase: "available",
    currentVersion,
    availableVersion: pendingUpdate.version,
  };
  try {
    await openUrl(pendingUpdate.url);
  } catch (error) {
    snapshot.phase = "error";
    snapshot.error = `${t("Couldn't open the download page.")} ${String(error)}`;
  }
  onProgress?.(snapshot);
  return snapshot;
}
