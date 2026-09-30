import { useSyncExternalStore } from "react";
const key = "mycode.workspaceSide";
const listeners = new Set<() => void>();
function read(): "left" | "right" {
  try {
    return localStorage.getItem(key) === "left" ? "left" : "right";
  } catch {
    return "right";
  }
}
export function setWorkspaceSide(side: "left" | "right") {
  localStorage.setItem(key, side);
  listeners.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
};
export function useWorkspaceSide() {
  return useSyncExternalStore(subscribe, read);
}
