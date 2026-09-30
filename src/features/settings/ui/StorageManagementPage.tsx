import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { useTranslation } from "../../../shared/i18n";
import { StorageSettings } from "./StorageSettings";

type Entry = {
  name: string;
  path: string;
  bytes: number;
  files: number;
  reclaimableBytes: number;
};
const size = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)} GB`
    : `${(bytes / 1024 ** 2).toFixed(2)} MB`;
export function StorageManagementPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState<"logs" | "database" | null>(null);
  const [threshold, setThreshold] = useState(
    () => Number(localStorage.getItem("mycode.storageWarningGB")) || 10,
  );
  const refresh = async () =>
    setEntries(await invoke<Entry[]>("storage_overview"));
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void run(refresh);
  }, []);
  const reclaimable =
    entries.find((e) => e.name === "Application data")?.reclaimableBytes || 0;
  return (
    <section className="space-y-5">
      <div className="flex justify-between text-sm">
        <span>{t("Local storage")}</span>
        <button disabled={busy} onClick={() => void run(refresh)}>
          {t(busy ? "Loading…" : "Refresh")}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => (
          <div key={entry.name} className="rounded-xl bg-content/5 p-4">
            <h3 className="text-sm">{t(entry.name)}</h3>
            <strong className="my-3 block text-xl tabular-nums">
              {size(entry.bytes)}
            </strong>
            <p className="text-xs text-content/55">
              {entry.files.toLocaleString()} {t("Files")}
            </p>
            <button
              title={entry.path}
              className="mt-3 max-w-full truncate text-xs text-accent"
              onClick={() => void run(() => revealItemInDir(entry.path))}
            >
              {entry.path}
            </button>
            {entry.bytes > threshold * 1024 ** 3 && (
              <p className="mt-3 text-xs text-amber-500">
                {t("Storage warning threshold exceeded")}
              </p>
            )}
          </div>
        ))}
      </div>
      <label className="flex items-center gap-3 text-sm">
        {t("Storage warning threshold")}
        <input
          type="number"
          min={1}
          max={1000}
          value={threshold}
          className="w-20 rounded-lg bg-content/5 p-2"
          onChange={(event) => {
            const value = Math.max(
              1,
              Math.min(1000, Number(event.target.value) || 1),
            );
            setThreshold(value);
            localStorage.setItem("mycode.storageWarningGB", String(value));
          }}
        />{" "}
        GB
      </label>
      <div className="rounded-xl bg-content/[0.035] p-4 text-sm">
        <h3>{t("Maintenance")}</h3>
        <p className="my-3 text-xs leading-relaxed text-content/55">
          {t(
            "Only diagnostic logs older than 7 days are cleaned. Conversations, attachments, recordings and drafts are preserved. Database compaction creates a backup first.",
          )}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            disabled={busy || !reclaimable}
            className="rounded-lg bg-content/5 px-3 py-2 disabled:opacity-40"
            onClick={() => setConfirm("logs")}
          >
            {t("Clean old logs")} · {size(reclaimable)}
          </button>
          <button
            disabled={busy}
            className="rounded-lg bg-content/5 px-3 py-2"
            onClick={() =>
              void run(async () => {
                const result = await invoke<string>("storage_database_check");
                setMessage(
                  result === "ok"
                    ? t("Database integrity check passed")
                    : result,
                );
              })
            }
          >
            {t("Check database")}
          </button>
          <button
            disabled={busy}
            className="rounded-lg bg-content/5 px-3 py-2"
            onClick={() => setConfirm("database")}
          >
            {t("Back up and compact database")}
          </button>
        </div>
      </div>
      {confirm && (
        <div
          role="alertdialog"
          aria-label={t("Confirm maintenance")}
          className="rounded-xl bg-accent/10 p-4 text-sm"
        >
          <p>
            {t(
              confirm === "logs"
                ? "Delete the scanned diagnostic logs older than 7 days?"
                : "Create a database backup, then compact it? Running database writes will wait until this completes.",
            )}
          </p>
          <div className="mt-3 flex gap-3">
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (confirm === "logs") {
                    const freed = await invoke<number>("storage_clean_logs");
                    setMessage(`${t("Space reclaimed")}: ${size(freed)}`);
                  } else {
                    const path = await invoke<string>(
                      "storage_database_compact",
                    );
                    setMessage(`${t("Backup saved")}: ${path}`);
                  }
                  setConfirm(null);
                  await refresh();
                })
              }
            >
              {t("Confirm")}
            </button>
            <button disabled={busy} onClick={() => setConfirm(null)}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p role="status" className="break-all text-sm">
          {message}
        </p>
      )}
      <StorageSettings />
    </section>
  );
}
