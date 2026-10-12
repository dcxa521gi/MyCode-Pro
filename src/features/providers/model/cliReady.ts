import { compareCliVersions } from "./cliVersion";
import { isTauri } from "@tauri-apps/api/core";
import { inspectHarnessBinary } from "../../../integrations/harness/core/child";
import { HARNESSES, type HarnessId } from "../../sessions/model/session";
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
  if (!HARNESSES.includes(provider)) return Promise.resolve(false);
  if (!isTauri()) return Promise.resolve(true);
  const key = `${sessionId}:${provider}`;
  const existing = checks.get(key);
  if (existing) return existing;
  const work = (async () => {
    try {
      const current = await inspectHarnessBinary(provider);
      if (current.version) return true;
      if (
        current.error &&
        !/not found|not installed|ENOENT|cannot find|未安装|找不到/i.test(
          current.error,
        )
      )
        throw Error(current.error);
    } catch (error) {
      if (
        !/not found|not installed|ENOENT|cannot find|未安装|找不到/i.test(
          String(error),
        )
      )
        throw error;
    }
    return new Promise<boolean>((finish) =>
      window.dispatchEvent(
        new CustomEvent<CliCheck>("mycode:cli-check", {
          detail: {
            provider,
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
