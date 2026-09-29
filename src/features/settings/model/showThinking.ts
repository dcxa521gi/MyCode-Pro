import { useSyncExternalStore } from "react";
const key = "mycode.showThinking";
const listeners = new Set<() => void>();
export function readShowThinking() {
  try {
    return localStorage.getItem(key) !== "false";
  } catch {
    return true;
  }
}
export function setShowThinking(value: boolean) {
  localStorage.setItem(key, String(value));
  listeners.forEach((fn) => fn());
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
}
export function useShowThinking() {
  return useSyncExternalStore(subscribe, readShowThinking, readShowThinking);
}
