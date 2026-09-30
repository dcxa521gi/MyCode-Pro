import { createPortal } from "react-dom";
import { ArrowDownCircle, Loader } from "../../shared/ui/icons";
import { useTranslation, formatMessage } from "../../shared/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  installPendingUpdate,
  launchPendingInstaller,
  skipPendingUpdate,
  isUpdateSkipped,
  probeForUpdate,
  readAppVersion,
  type UpdaterSnapshot,
} from "../model/updater";
import type { InstalledUpdate } from "../model/updateNotice";
import { UpdateRailCard } from "./UpdateRailCard";

// The sidebar row only earns its space when there is something to act on: an
// update waiting to be installed, or one already downloading. Every other phase
// — including a probe that failed — stays silent, because manual "Check for
// updates" already lives in Settings and the app menu.
export function isSidebarUpdateActionable(snapshot: UpdaterSnapshot): boolean {
  return (
    snapshot.phase === "available" ||
    snapshot.phase === "downloading" ||
    snapshot.phase === "downloaded" ||
    snapshot.phase === "error"
  );
}

export function SidebarUpdateFooter({
  update,
  onOpenWhatsNew,
  onDismissUpdate,
}: {
  update?: InstalledUpdate | null;
  onOpenWhatsNew?: (version: string) => void;
  onDismissUpdate?: () => void;
}) {
  const [snapshot, setSnapshot] = useState<UpdaterSnapshot>({
    phase: "idle",
    currentVersion: "…",
  });

  useEffect(() => {
    const update = (e: Event) =>
      setSnapshot((e as CustomEvent<UpdaterSnapshot>).detail);
    window.addEventListener("mycode-update", update);
    return () => window.removeEventListener("mycode-update", update);
  }, []);
  // The automatic probe runs on mount whether or not it ends up rendering
  // anything, so a newly published version still surfaces on its own. The
  // snapshot lives here rather than in SidebarUpdate so the footer can drop its
  // padding entirely when neither child has anything to show.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const currentVersion = await readAppVersion();
      if (cancelled) return;
      setSnapshot({ phase: "checking", currentVersion });

      try {
        const update = await probeForUpdate();
        if (cancelled) return;
        if (update && !isUpdateSkipped(update.version)) {
          setSnapshot({
            phase: "available",
            currentVersion,
            availableVersion: update.version,
            notes: update.body,
          });
          await installPendingUpdate((next) => {
            if (!cancelled) setSnapshot(next);
          });
          return;
        }
        setSnapshot({ phase: "current", currentVersion });
      } catch {
        if (cancelled) return;
        setSnapshot({ phase: "idle", currentVersion });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const card =
    update && onOpenWhatsNew && onDismissUpdate ? (
      <UpdateRailCard
        update={update}
        onOpen={onOpenWhatsNew}
        onDismiss={onDismissUpdate}
      />
    ) : null;
  const actionable = isSidebarUpdateActionable(snapshot);

  if (!card && !actionable) return null;

  // The gap down to the Settings block belongs to that block's own padding, so
  // the footer can disappear without leaving the sidebar's bottom row flush
  // against the scrolling list above it.
  return (
    <div className="flex flex-col gap-1.5 p-2 pb-0">
      {card}
      {actionable ? (
        <SidebarUpdate snapshot={snapshot} onSnapshot={setSnapshot} />
      ) : null}
    </div>
  );
}

export function SidebarUpdate({
  snapshot,
  onSnapshot,
}: {
  snapshot: UpdaterSnapshot;
  onSnapshot: (next: UpdaterSnapshot) => void;
}) {
  const { t } = useTranslation();
  const busy = snapshot.phase === "downloading";
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  // `busy` only flips after installPendingUpdate awaits readAppVersion, so a
  // second click can still land. The ref closes that window immediately.
  const installing = useRef(false);

  const onClick = useCallback(async () => {
    if (busy || installing.current) return;
    if (snapshot.phase === "downloaded") {
      setOpen(true);
      return;
    }
    installing.current = true;
    try {
      await installPendingUpdate(onSnapshot);
    } finally {
      installing.current = false;
    }
  }, [busy, onSnapshot, snapshot.phase]);

  const label = busy
    ? `${t("Downloading")}${snapshot.progress != null ? ` ${snapshot.progress}%` : "…"}`
    : snapshot.phase === "downloaded"
      ? t("Update downloaded — click to install")
      : snapshot.phase === "error"
        ? t("Update download failed. Click to retry.")
        : formatMessage("Download version {version}", {
            version: snapshot.availableVersion ?? "",
          });

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
          busy
            ? "bg-content/5 text-content/75 hover:bg-content/10 hover:text-content"
            : "bg-accent/15 text-content hover:bg-accent/20"
        } disabled:cursor-default disabled:opacity-70`}
      >
        <span className="grid size-[18px] shrink-0 place-items-center">
          {busy ? (
            <Loader className="size-4 animate-spin opacity-70" aria-hidden />
          ) : (
            <ArrowDownCircle className="size-4 text-accent" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1 flex items-center">
          <span className="block truncate text-[12px] font-medium leading-tight">
            {label}
          </span>
          <span className="ml-auto block text-[11px] text-content/40">
            {t("v")}
            {snapshot.currentVersion}
          </span>
        </span>
      </button>
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] grid place-items-center bg-black/50 p-6"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("Install new version")}
              className="w-full max-w-xl rounded-2xl bg-surface p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-3 text-lg font-medium">
                MyCode {snapshot.availableVersion}
              </h2>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap font-sans text-sm text-content/70">
                {snapshot.notes || t("No release notes.")}
              </pre>
              {error && (
                <p role="alert" className="mt-2 text-red-400">
                  {error}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-3">
                <button onClick={() => setOpen(false)}>{t("Later")}</button>
                <button
                  onClick={() => {
                    skipPendingUpdate();
                    setOpen(false);
                  }}
                >
                  {t("Skip this version")}
                </button>
                <button
                  className="rounded-lg bg-accent px-4 py-2 text-white"
                  onClick={() =>
                    void launchPendingInstaller().catch((e) =>
                      setError(String(e)),
                    )
                  }
                >
                  {t("Install new version")}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
