import { useSyncExternalStore } from "react";
export type WorkMode = "development" | "office";
const key = "mycode.workMode";
const listeners = new Set<() => void>();
export function loadWorkMode(): WorkMode {
  try {
    return localStorage.getItem(key) === "office" ? "office" : "development";
  } catch {
    return "development";
  }
}
export function setWorkMode(mode: WorkMode) {
  localStorage.setItem(key, mode);
  listeners.forEach((fn) => fn());
  window.dispatchEvent(new CustomEvent("mycode:work-mode", { detail: mode }));
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  const storage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) fn();
  };
  window.addEventListener("storage", storage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", storage);
  };
}
export function useWorkMode() {
  return useSyncExternalStore(subscribe, loadWorkMode);
}
