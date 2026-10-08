import { compareCliVersions } from "./cliVersion";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { inspectHarnessBinary } from "../../../integrations/harness/core/child";
import type { HarnessId } from "../../sessions/model/session";
export type CliCheck = {
  provider: HarnessId;
  installed?: string;
  latest?: string;
  error?: string;
  finish: (ready: boolean) => void;
};
const checks = new Map<string, Promise<boolean>>();
export function newerCliVersion(installed: string, latest: string): boolean {
  return (compareCliVersions(installed, latest) ?? 0) > 0;
}
export function ensureCliReady(
  provider: HarnessId,
  sessionId: string,
): Promise<boolean> {
  if (!isTauri()) return Promise.resolve(true);
  const key = `${sessionId}:${provider}`;
  const existing = checks.get(key);
  if (existing) return existing;
  const work = (async () => {
    const [current, release] = await Promise.allSettled([
      inspectHarnessBinary(provider),
      invoke<{ version: string }>("managed_cli_latest", { provider }),
    ]);
    const installed =
      current.status === "fulfilled" ? current.value.version : undefined;
    const latest =
      release.status === "fulfilled" ? release.value.version : undefined;
    if (installed && latest && !newerCliVersion(installed, latest)) return true;
    return new Promise<boolean>((finish) =>
      window.dispatchEvent(
        new CustomEvent<CliCheck>("mycode:cli-check", {
          detail: {
            provider,
            installed,
            latest,
            error:
              release.status === "rejected"
                ? String(release.reason)
                : undefined,
            finish,
          },
        }),
      ),
    );
  })();
  checks.set(key, work);
  void work.then(
    (ready) => {
      if (!ready) checks.delete(key);
    },
    () => checks.delete(key),
  );
  return work;
}
