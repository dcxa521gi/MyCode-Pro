import { invoke } from "@tauri-apps/api/core";
/** Migrate the previous UI-only preference once; native configuration wins afterwards. */
export function defaultWorkspace(): Promise<string> {
  const legacy = localStorage.getItem("mycode.defaultWorkspace.development") || localStorage.getItem("mycode.defaultWorkspace.office");
  return invoke<string>("default_workspace", { legacy });
}
