import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
import type { SessionSummary } from "../../sessions/data/sessionStore";
type Candidate = {
  id: string;
  source: string;
  title: string;
  cwd: string;
  turns: number;
  existing: boolean;
};
export function TaskImportPage({
  onOpenSession,
}: {
  onOpenSession?: (session: SessionSummary) => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState("");
  const [imported, setImported] = useState<SessionSummary[]>([]);
  const scan = async () => {
    setBusy(true);
    setStatus("");
    try {
      setItems(await invoke<Candidate[]>("task_import_scan"));
      setSelected(new Set());
    } catch {
      setStatus("Could not scan local conversations.");
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    setBusy(true);
    setStatus("");
    const saved: SessionSummary[] = [];
    try {
      for (const id of selected) {
        saved.push(await invoke<SessionSummary>("task_import_commit", { id }));
        setItems((current) =>
          current.map((c) => (c.id === id ? { ...c, existing: true } : c)),
        );
      }
      setSelected(new Set());
      setStatus("Import completed. Open a task below to continue.");
    } catch {
      setStatus(
        "Some tasks could not be imported. Completed imports have been kept.",
      );
    } finally {
      setImported((current) => [...current, ...saved]);
      setSelected(
        (current) =>
          new Set(
            [...current].filter(
              (id) => !saved.some((session) => session.id === id),
            ),
          ),
      );
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <p className="text-sm text-content/60">
        {t(
          "Scan local Claude and Codex history, preview and select tasks to import. Original files are never modified.",
        )}
      </p>
      <div className="flex gap-3">
        <button
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-black disabled:opacity-40"
          onClick={() => void scan()}
        >
          {t(busy ? "Working…" : "Scan local tasks")}
        </button>
        <button disabled={busy || !selected.size} onClick={() => void run()}>
          {t("Import selected")} ({selected.size})
        </button>
        <select
          aria-label={t("Source")}
          className="rounded-lg border border-content/15 bg-surface px-2"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">{t("All agents")}</option>
          <option>claude</option>
          <option>codex</option>
        </select>
      </div>
      {status && <p role="status">{t(status)}</p>}
      <div className="space-y-2">
        {items
          .filter((c) => !filter || c.source === filter)
          .map((c) => (
            <label
              key={c.id}
              className="flex items-start gap-3 rounded-xl border border-content/10 p-4"
            >
              <input
                type="checkbox"
                disabled={busy || c.existing}
                checked={selected.has(c.id)}
                onChange={(e) =>
                  setSelected((current) => {
                    const next = new Set(current);
                    e.target.checked ? next.add(c.id) : next.delete(c.id);
                    return next;
                  })
                }
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{c.title}</div>
                <div className="mt-1 truncate text-xs text-content/40">
                  {c.source} · {c.cwd}
                </div>
              </div>
              <span className="text-xs text-content/50">
                {c.existing ? t("Imported") : c.turns}
              </span>
            </label>
          ))}
      </div>
      {imported.map((s) => (
        <button
          key={s.id}
          className="block rounded-lg bg-content/5 px-4 py-2 text-sm"
          onClick={() => onOpenSession?.(s)}
        >
          {t("Open task")}: {s.title}
        </button>
      ))}
    </section>
  );
}
