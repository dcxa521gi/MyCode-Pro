import { invoke } from "@tauri-apps/api/core";
import { useEffect, useSyncExternalStore } from "react";
import { inspectHarnessBinary } from "../../../integrations/harness/core/child";
import type { ConfigurableBinaryProvider } from "./providerBinaryPaths";
import { compareCliVersions } from "./cliVersion";

export type CLIState = {
  phase: "idle" | "checking" | "missing" | "update" | "current" | "error";
  installed?: string;
  latest?: string;
  error?: string;
  checkedAt?: number;
};
const empty: CLIState = { phase: "idle" };
const states = new Map<ConfigurableBinaryProvider, CLIState>();
const revisions = new Map<ConfigurableBinaryProvider, number>();
const pending = new Map<ConfigurableBinaryProvider, Promise<CLIState>>();
const subscribers = new Set<() => void>();
let active = 0;
const waiters: (() => void)[] = [];
async function acquire() {
  if (active >= 2) await new Promise<void>((resolve) => waiters.push(resolve));
  else active++;
}
function release() {
  const next = waiters.shift();
  if (next) next();
  else active--;
}
export const cliState = (provider: ConfigurableBinaryProvider) =>
  states.get(provider) ?? empty;
export function subscribeCLIVersions(callback: () => void) {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}
function save(provider: ConfigurableBinaryProvider, state: CLIState) {
  states.set(provider, state);
  subscribers.forEach((fn) => fn());
  return state;
}
export function invalidateCLIVersion(provider: ConfigurableBinaryProvider) {
  revisions.set(provider, (revisions.get(provider) ?? 0) + 1);
  pending.delete(provider);
  save(provider, { phase: "idle" });
}
if (typeof window !== "undefined")
  window.addEventListener("mycode-cli-paths-changed", (event) => {
    const provider = (
      event as CustomEvent<{ provider?: ConfigurableBinaryProvider }>
    ).detail?.provider;
    if (provider) invalidateCLIVersion(provider);
    else for (const id of states.keys()) invalidateCLIVersion(id);
  });
export function checkCLIVersion(
  provider: ConfigurableBinaryProvider,
  force = false,
): Promise<CLIState> {
  const existing = pending.get(provider);
  if (existing) return existing;
  const cached = cliState(provider);
  if (
    !force &&
    cached.checkedAt !== undefined &&
    Date.now() - cached.checkedAt < 300000
  )
    return Promise.resolve(cached);
  const revision = revisions.get(provider) ?? 0;
  save(provider, { ...cached, phase: "checking", error: undefined });
  const work = (async () => {
    await acquire();
    let state: CLIState;
    try {
      const current = await inspectHarnessBinary(provider);
      if (!current.version)
        state = {
          phase: "error",
          error: current.error || "CLI returned no valid version.",
        };
      else {
        try {
          const release = await invoke<{ version: string }>(
            "managed_cli_latest",
            { provider },
          );
          const comparison = compareCliVersions(
            current.version,
            release.version,
          );
          state = {
            phase:
              comparison === null
                ? "error"
                : comparison > 0
                  ? "update"
                  : "current",
            installed: current.version,
            latest: release.version,
            ...(comparison === null
              ? {
                  error:
                    "Could not compare CLI versions. Retry the version check.",
                }
              : {}),
          };
        } catch (error) {
          state = {
            phase: "error",
            installed: current.version,
            error: String(error),
          };
        }
      }
    } catch (error) {
      const message = String(error);
      state = /not found|not installed|ENOENT|cannot find|找不到|未安装/i.test(
        message,
      )
        ? { phase: "missing" }
        : { phase: "error", error: message };
    }
    release();
    state.checkedAt = Date.now();
    return (revisions.get(provider) ?? 0) === revision
      ? save(provider, state)
      : cliState(provider);
  })();
  pending.set(provider, work);
  void work.finally(() => {
    if (pending.get(provider) === work) pending.delete(provider);
  });
  return work;
}
export function useCLIVersion(provider: ConfigurableBinaryProvider) {
  const state = useSyncExternalStore(subscribeCLIVersions, () =>
    cliState(provider),
  );
  useEffect(() => {
    void checkCLIVersion(provider);
  }, [provider]);
  useEffect(() => {
    if (state.phase === "idle") void checkCLIVersion(provider);
  }, [provider, state.phase]);
  return state;
}
