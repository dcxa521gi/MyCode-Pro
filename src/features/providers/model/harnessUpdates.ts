import { invoke } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { HarnessId } from "../../sessions/model/session";
import { compareCliVersions, cliVersionLabel } from "./cliVersion";

/**
 * Active CLIs with official npm/vendor release feeds and managed installers.
 */
export const UPDATABLE_HARNESSES: ReadonlySet<HarnessId> = new Set([
  "claude",
  "codex",
  "opencode",
  "pi",
  "cursor",
  "grok",
  "hermes",
  "minimax",
  "mimo",
  "devin",
]);

export type HarnessUpdate = {
  harness: HarnessId;
  installed: string;
  latest: string;
};

export type HarnessUpdateDeps = {
  /** Installed harnesses the user has not hidden. */
  harnesses: HarnessId[];
  installedVersion: (harness: HarnessId) => Promise<string | undefined>;
  latestVersion: (harness: HarnessId) => Promise<string>;
};

/** Every window keeps its own model catalog, so each has to hear about it. */
const HARNESS_UPDATED_EVENT = "harness-updated";
const updateEventSource = crypto.randomUUID();

type HarnessUpdatedEvent = {
  harness: HarnessId;
  source: string;
};

export function announceHarnessUpdated(harness: HarnessId): Promise<void> {
  return emit(HARNESS_UPDATED_EVENT, { harness, source: updateEventSource });
}

export function onHarnessUpdated(
  handler: (harness: HarnessId, phase?: "installed") => void,
): Promise<UnlistenFn> {
  const stops: UnlistenFn[] = [];
  return (async () => {
    try {
      stops.push(
        await listen<HarnessUpdatedEvent>(HARNESS_UPDATED_EVENT, (event) => {
          // The sender awaited its local refresh before announcing the update.
          if (
            event.payload.source === updateEventSource ||
            !UPDATABLE_HARNESSES.has(event.payload.harness)
          )
            return;
          handler(event.payload.harness);
        }),
      );
      stops.push(
        await listen<string>("mycode-cli-updated", (event) => {
          if (UPDATABLE_HARNESSES.has(event.payload as HarnessId))
            handler(event.payload as HarnessId, "installed");
        }),
      );
      return () => {
        for (const stop of stops) stop();
      };
    } catch (error) {
      for (const stop of stops) stop();
      throw error;
    }
  })();
}

export function claimLaunchHarnessUpdateCheck(): Promise<boolean> {
  return invoke<boolean>("harness_update_check_claim");
}

export async function fetchLatestHarnessVersion(
  harness: HarnessId,
): Promise<string> {
  if (["claude", "codex", "opencode", "pi"].includes(harness))
    return invoke<string>("harness_latest_version", { provider: harness });
  return (
    await invoke<{ version: string }>("managed_cli_latest", {
      provider: harness,
    })
  ).version;
}

/**
 * A failed lookup, offline or otherwise, drops that harness silently: this
 * runs unprompted at launch and must never surface an error of its own.
 * Nothing is remembered between launches: a harness still behind is offered
 * again, at whatever release is newest by then.
 */
export async function findHarnessUpdates({
  harnesses,
  installedVersion,
  latestVersion,
}: HarnessUpdateDeps): Promise<HarnessUpdate[]> {
  const results: (HarnessUpdate | null)[] = harnesses.map(() => null);
  let index = 0;
  const worker = async () => {
    while (index < harnesses.length) {
      const position = index++;
      const harness = harnesses[position];
      const result = await (async (): Promise<HarnessUpdate | null> => {
        if (!UPDATABLE_HARNESSES.has(harness)) return null;
        try {
          const [installedOutput, latestOutput] = await Promise.all([
            installedVersion(harness),
            latestVersion(harness),
          ]);
          const installed = cliVersionLabel(
            installedOutput ?? "",
            latestOutput,
          );
          const latest = cliVersionLabel(latestOutput);
          if (!installed || !latest) return null;
          if (
            (compareCliVersions(installedOutput ?? "", latestOutput) ?? 0) <= 0
          )
            return null;
          return { harness, installed, latest };
        } catch {
          return null;
        }
      })();
      results[position] = result;
    }
  };
  await Promise.all([worker(), worker()]);
  return results.filter((update): update is HarnessUpdate => update !== null);
}
