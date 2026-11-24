import { invoke } from "@tauri-apps/api/core";
export type IMPluginState = {
  current: string;
  latest: string;
  available: boolean;
  staged: boolean;
};
export const IM_PLUGIN_AUTO_KEY = "mycode.imPluginAutoUpdate";
export function imPluginAutoUpdate(): boolean {
  return localStorage.getItem(IM_PLUGIN_AUTO_KEY) !== "false";
}
export function updateIMPlugin(install: boolean): Promise<IMPluginState> {
  return invoke("im_plugin_update", { install });
}
let pending: Promise<void> | undefined;
export function autoUpdateIMPlugin(): Promise<void> {
  if (
    !imPluginAutoUpdate() ||
    Date.now() - Number(localStorage.getItem("mycode.imPluginCheckedAt") || 0) <
      12 * 60 * 60 * 1000
  )
    return Promise.resolve();
  return (pending ??= updateIMPlugin(true)
    .then((state) => {
      localStorage.setItem("mycode.imPluginCheckedAt", String(Date.now()));
      if (state.staged)
        localStorage.setItem("mycode.imPluginStaged", state.latest);
    })
    .catch(() => {
      /* background checks keep the installed transport available offline */
    })
    .finally(() => {
      pending = undefined;
    }));
}
