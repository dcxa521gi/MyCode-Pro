import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GlassBackdrop } from "../../../app/shell/GlassBackdrop";
import {
  isHarnessAvailable,
  probeHarnessAvailability,
} from "../../../integrations/harness/core/availability";
import {
  inspectHarnessBinary,
  updateHarnessCli,
} from "../../../integrations/harness/core/child";
import { compareCliVersions, cliVersionLabel } from "../model/cliVersion";
import { invalidateCLIVersion } from "../model/cliVersions";
import { initializeProviderBinaryPaths } from "../model/providerBinaryPaths";
import { refreshHarnessCatalogs } from "../../../integrations/harness/core/registry";
import { LAYER } from "../../../shared/lib/layers";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Loader,
  X,
} from "../../../shared/ui/icons";
import {
  formatMessage,
  translate as t,
  useTranslation,
} from "../../../shared/i18n";
import { isPickerProviderVisible } from "../../sessions/model/models";
import {
  HARNESS_TITLE,
  HARNESSES,
  type HarnessId,
} from "../../sessions/model/session";
import { HarnessIcon } from "../../sessions/ui/HarnessIcon";
import { cliErrorMessage } from "../model/cliErrors";
import {
  announceHarnessUpdated,
  claimLaunchHarnessUpdateCheck,
  fetchLatestHarnessVersion,
  findHarnessUpdates,
  onHarnessUpdated,
  UPDATABLE_HARNESSES,
  type HarnessUpdate,
} from "../model/harnessUpdates";

/**
 * Shared by every mount in this window: a StrictMode remount must reuse the
 * first run, since the launch claim it made cannot be taken twice.
 */
let launchCheck: Promise<HarnessUpdate[]> | null = null;

function checkForHarnessUpdates(): Promise<HarnessUpdate[]> {
  launchCheck ??= runLaunchCheck().catch(() => []);
  return launchCheck;
}

async function runLaunchCheck(): Promise<HarnessUpdate[]> {
  if (!(await claimLaunchHarnessUpdateCheck())) return [];
  await probeHarnessAvailability();
  return findHarnessUpdates({
    harnesses: HARNESSES.filter(
      (id) =>
        UPDATABLE_HARNESSES.has(id) &&
        isHarnessAvailable(id) &&
        isPickerProviderVisible(id),
    ),
    installedVersion: async (id) => (await inspectHarnessBinary(id)).version,
    latestVersion: fetchLatestHarnessVersion,
  });
}

type RowState =
  | { status: "idle" }
  | { status: "updating" }
  | { status: "updated"; version: string }
  | { status: "failed"; error: string };

/**
 * Some updaters exit cleanly without installing anything, so success is the
 * version the CLI reports afterwards, not the exit code. Its models are
 * reloaded before the row says so, so the picker is current by then.
 */
async function runUpdate(update: HarnessUpdate): Promise<RowState> {
  try {
    await updateHarnessCli(update.harness, update.latest);
    const after = await inspectHarnessBinary(update.harness);
    const version = cliVersionLabel(after.version ?? "", update.latest);
    const comparison = compareCliVersions(after.version ?? "", update.latest);
    if (version && comparison !== null && comparison <= 0) {
      invalidateCLIVersion(update.harness);
      await refreshHarnessCatalogs([update.harness], { force: true });
      void announceHarnessUpdated(update.harness).catch(() => undefined);
      return { status: "updated", version };
    }
    return {
      status: "failed",
      error: `Still on ${version ?? update.installed} after updating.`,
    };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Checked once per app launch, in whichever window asks first. */
export function HarnessUpdateNotice({
  topOffset = 12,
  onHeightChange,
}: {
  topOffset?: number;
  onHeightChange?: (height: number) => void;
}) {
  useTranslation();
  const panelRef = useRef<HTMLElement>(null);
  const [updates, setUpdates] = useState<HarnessUpdate[]>([]);
  const [rows, setRows] = useState<Partial<Record<HarnessId, RowState>>>({});
  const [collapsed, setCollapsed] = useState(false);

  // Mounted in every window, so the window that ran the update tells the
  // others to pick up the new CLI's models too.
  useEffect(() => {
    const unlisten = onHarnessUpdated((harness, phase) => {
      invalidateCLIVersion(harness);
      // The installer emits before verification/activation. Refresh models
      // only after the selected path was successfully activated and announced.
      if (phase === "installed") return;
      void initializeProviderBinaryPaths()
        .then(() => probeHarnessAvailability({ force: true }))
        .then(() => refreshHarnessCatalogs([harness], { force: true }))
        .catch(() => undefined);
    }).catch(() => undefined);
    return () => {
      void unlisten.then((stop) => stop?.());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void checkForHarnessUpdates().then((next) => {
      if (!cancelled) setUpdates(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = updates.length > 0;
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !onHeightChange) return;
    const measure = () => onHeightChange(panel.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => {
      observer.disconnect();
      onHeightChange(0);
    };
  }, [visible, onHeightChange]);
  if (!visible) return null;

  const stateOf = (harness: HarnessId): RowState =>
    rows[harness] ?? { status: "idle" };
  const busy = updates.some(
    (update) => stateOf(update.harness).status === "updating",
  );
  const pending = updates.filter((update) => {
    const status = stateOf(update.harness).status;
    return status === "idle" || status === "failed";
  });
  const anyUpdated = updates.some(
    (update) => stateOf(update.harness).status === "updated",
  );
  const activeUpdate =
    updates.find((update) => stateOf(update.harness).status === "updating") ??
    updates.find((update) => stateOf(update.harness).status !== "updated") ??
    updates[0];

  const start = (targets: HarnessUpdate[]) => {
    for (const update of targets) {
      setRows((current) => ({
        ...current,
        [update.harness]: { status: "updating" },
      }));
      void runUpdate(update).then((result) =>
        setRows((current) => ({ ...current, [update.harness]: result })),
      );
    }
  };
  const dismiss = () => {
    // Only for this run: the next launch checks and offers again.
    launchCheck = Promise.resolve([]);
    setUpdates([]);
  };

  return createPortal(
    <section
      ref={panelRef}
      aria-label={t("Harness updates")}
      role="status"
      style={{ zIndex: LAYER.toast, top: topOffset }}
      className="fixed right-3 isolate w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-xl border border-content/10 text-content shadow-xl"
    >
      <GlassBackdrop />
      <div className="relative z-[1]">
        <div
          className={`flex items-center gap-2 px-3 py-2 ${collapsed ? "" : "border-b border-stroke"}`}
        >
          <button
            type="button"
            aria-label={t(
              collapsed ? "Expand CLI updates" : "Collapse CLI updates",
            )}
            aria-expanded={!collapsed}
            className="grid size-6 shrink-0 place-items-center rounded-md text-content/60 hover:bg-content/10"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
          <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
            {collapsed && activeUpdate
              ? `${HARNESS_TITLE[activeUpdate.harness]} · ${t(stateOf(activeUpdate.harness).status === "updating" ? "Updating" : "Harness update available")}`
              : updates.length === 1
                ? t("Harness update available")
                : t("Harness updates available")}
          </span>
          {!collapsed && pending.length > 1 ? (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-medium text-content/70 hover:bg-content/10 hover:text-content"
              onClick={() => start(pending)}
            >
              {t("Update all")}
            </button>
          ) : null}
          <button
            type="button"
            aria-label={t("Dismiss harness updates")}
            disabled={busy}
            className="grid size-6 shrink-0 place-items-center rounded-md text-content/40 hover:bg-content/10 hover:text-content disabled:opacity-40 disabled:hover:bg-transparent"
            onClick={dismiss}
          >
            <X className="size-3" strokeWidth={2} />
          </button>
        </div>
        {!collapsed && (
          <div
            className="divide-y divide-stroke overflow-y-auto"
            style={{
              maxHeight: `max(48px, calc(100dvh - ${topOffset + 110}px))`,
            }}
          >
            {updates.map((update) => (
              <HarnessUpdateRow
                key={update.harness}
                update={update}
                state={stateOf(update.harness)}
                onUpdate={() => start([update])}
              />
            ))}
          </div>
        )}
        {!collapsed && (
          <p className="border-t border-stroke px-3 py-2 text-[11px] text-content/50">
            {anyUpdated
              ? t("Model picker refreshed with the new version’s models.")
              : t("New models often need the latest version.")}
          </p>
        )}
      </div>
    </section>,
    document.body,
  );
}

function HarnessUpdateRow({
  update,
  state,
  onUpdate,
}: {
  update: HarnessUpdate;
  state: RowState;
  onUpdate: () => void;
}) {
  return (
    <article className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <HarnessIcon harness={update.harness} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
          {HARNESS_TITLE[update.harness]}
        </span>
        {state.status === "updated" ? (
          <span className="flex min-w-0 max-w-[55%] items-center gap-1 text-[11px] text-emerald-400">
            <Check className="size-3.5" />
            <span className="truncate" title={state.version}>
              {formatMessage("Updated to {version}", {
                version: state.version,
              })}
            </span>
          </span>
        ) : (
          <>
            <span
              title={`${update.installed} → ${update.latest}`}
              className="min-w-0 max-w-[45%] truncate font-mono text-[11px] text-content/50"
            >
              {update.installed} → {update.latest}
            </span>
            <button
              type="button"
              disabled={state.status === "updating"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-content/10 px-2 py-1 text-[11px] font-medium hover:bg-content/15 disabled:opacity-60 disabled:hover:bg-content/10"
              onClick={onUpdate}
            >
              {state.status === "updating" ? (
                <>
                  <Loader className="size-3 animate-spin" />
                  {t("Updating")}
                </>
              ) : state.status === "failed" ? (
                t("Retry")
              ) : (
                t("Update")
              )}
            </button>
          </>
        )}
      </div>
      {state.status === "failed" ? (
        <p
          role="alert"
          className="mt-1.5 text-[11px] leading-relaxed text-red-300/90 [overflow-wrap:anywhere]"
          title={cliErrorMessage(state.error)}
        >
          {cliErrorMessage(state.error)}
        </p>
      ) : null}
    </article>
  );
}
