import { useSyncExternalStore, type SetStateAction } from "react";
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
// The scan belongs to this application session, not the settings page lifetime.
// Keep paths in memory instead of persisting conversation metadata to web storage.
type ImportState = {
  items: Candidate[];
  selected: Set<string>;
  busy: boolean;
  status: string;
  filter: string;
  imported: SessionSummary[];
  page: number;
};
let snapshot: ImportState = {
  items: [],
  selected: new Set(),
  busy: false,
  status: "",
  filter: "",
  imported: [],
  page: 0,
};
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function update<K extends keyof ImportState>(
  key: K,
  value: SetStateAction<ImportState[K]>,
) {
  const next =
    typeof value === "function"
      ? (value as (previous: ImportState[K]) => ImportState[K])(snapshot[key])
      : value;
  snapshot = { ...snapshot, [key]: next };
  listeners.forEach((listener) => listener());
}
export function TaskImportPage({
  onOpenSession,
}: {
  onOpenSession?: (session: SessionSummary) => void;
}) {
  const { t } = useTranslation();
  const state = useSyncExternalStore(subscribe, () => snapshot);
  const { items, selected, busy, status, filter, imported } = state;
  const filtered = items.filter((c) => !filter || c.source === filter);
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const page = Math.min(state.page, pages - 1);
  const setItems = (value: SetStateAction<Candidate[]>) =>
    update("items", value);
  const setSelected = (value: SetStateAction<Set<string>>) =>
    update("selected", value);
  const setBusy = (value: boolean) => update("busy", value);
  const setStatus = (value: string) => update("status", value);
  const setFilter = (value: string) => {
    update("filter", value);
    update("page", 0);
  };
  const setImported = (value: SetStateAction<SessionSummary[]>) =>
    update("imported", value);
  const scan = async () => {
    setBusy(true);
    setStatus("");
    try {
      setItems(await invoke<Candidate[]>("task_import_scan"));
      setSelected(new Set());
      update("page", 0);
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
          "Scan local agent history, preview and select tasks to import. Original files are never modified.",
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
        <div
          role="radiogroup"
          aria-label={t("Source")}
          className="flex flex-wrap gap-1 rounded-full bg-content/5 p-1"
        >
          {[
            ["", t("All agents")],
            ["claude", "Claude"],
            ["codex", "Codex"],
            ["workbuddy", "WorkBuddy"],
          ].map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={filter === value}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${filter === value ? "bg-accent text-black" : "text-content/70 hover:bg-content/10"}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {status && <p role="status">{t(status)}</p>}
      <div className="flex items-center gap-4 text-sm">
        <span>
          {t("Tasks")}: {filtered.length}
        </span>
        <button
          disabled={busy}
          onClick={() =>
            setSelected(
              (current) =>
                new Set([
                  ...current,
                  ...filtered.filter((c) => !c.existing).map((c) => c.id),
                ]),
            )
          }
        >
          {t("Select all")}
        </button>
        <button
          disabled={busy || !selected.size}
          onClick={() => setSelected(new Set())}
        >
          {t("Deselect all")}
        </button>
        <button disabled={page === 0} onClick={() => update("page", page - 1)}>
          {t("Previous page")}
        </button>
        <span>
          {page + 1} / {pages}
        </span>
        <button
          disabled={page + 1 >= pages}
          onClick={() => update("page", page + 1)}
        >
          {t("Next page")}
        </button>
      </div>
      <div className="space-y-2">
        {filtered.slice(page * 20, (page + 1) * 20).map((c, index) => (
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
            <span className="text-xs text-content/40" title={c.id}>
              #{page * 20 + index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="rounded bg-content/10 px-2 py-0.5 text-xs">
                  {c.source === "workbuddy"
                    ? "WorkBuddy"
                      : c.source === "codex"
                        ? "Codex"
                        : "Claude"}
                </span>
                <span className="truncate">{c.title}</span>
              </div>
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
