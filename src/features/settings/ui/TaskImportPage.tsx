import { useState, useSyncExternalStore, type SetStateAction } from "react";
import { Modal } from "../../../shared/ui/Modal";
import {
  RefreshCw,
  ArrowDownCircle,
  Search,
  Eye,
  Check,
  CircleAlert,
} from "../../../shared/ui/icons";
import { SecondaryButton } from "../../../shared/ui/SecondaryButton";
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
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<{
    title: string;
    blocks: { role: string; text: string }[];
  } | null>(null);
  const [result, setResult] = useState<{
    saved: SessionSummary[];
    failed: number;
  } | null>(null);
  const [progress, setProgress] = useState(0);
  const state = useSyncExternalStore(subscribe, () => snapshot);
  const { items, selected, busy, status, filter, imported } = state;
  const filtered = items.filter(
    (c) =>
      (!filter || c.source === filter) &&
      `${c.title} ${c.cwd}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
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
    setProgress(0);
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
    setProgress(0);
    setBusy(true);
    setStatus("");
    const saved: SessionSummary[] = [];
    try {
      for (const id of selected) {
        saved.push(await invoke<SessionSummary>("task_import_commit", { id }));
        setItems((current) =>
          current.map((c) => (c.id === id ? { ...c, existing: true } : c)),
        );
        setProgress(saved.length);
      }
      setSelected(new Set());
      setStatus("Import completed. Open a task below to continue.");
    } catch {
      setStatus(
        "Some tasks could not be imported. Completed imports have been kept.",
      );
    } finally {
      setResult({ saved, failed: selected.size - saved.length });
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
    <section className="space-y-5">
      <p className="text-sm text-content/60">
        {t(
          "Scan local agent history, preview and select tasks to import. Original files are never modified.",
        )}
      </p>
      <div className="grid grid-cols-3 gap-3">
        {[
          [t("Local tasks"), items.length],
          [t("Ready to import"), items.filter((c) => !c.existing).length],
          [t("Selected"), selected.size],
        ].map(([label, count]) => (
          <div
            key={label}
            className="rounded-xl border border-content/10 bg-content/[0.025] p-4"
          >
            <p className="text-xs text-content/50">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{count}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-content/15 bg-content/5 px-4 py-2 text-sm disabled:opacity-40 hover:bg-content/10"
          onClick={() => void scan()}
        >
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {t("Scan local tasks")}
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-lg bg-content px-4 py-2 text-sm text-background-base disabled:opacity-40"
          disabled={busy || !selected.size}
          onClick={() => void run()}
        >
          {t("Import selected")} ({selected.size})
          <ArrowDownCircle className="size-4" />
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
            ["minimax", "MiniMax Code"],
            ["cursor", "Cursor"],
            ["opencode", "OpenCode"],
          ].map(([value, label]) => (
            <button
              key={value}
              role="radio"
              aria-checked={filter === value}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${filter === value ? "bg-selection text-content" : "text-content/70 hover:bg-content/10"}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 rounded-xl border border-content/10 bg-content/[0.025] px-3 py-2.5">
        <Search className="size-4 text-content/45" />
        <input
          aria-label={t("Search tasks")}
          placeholder={t("Search tasks")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            update("page", 0);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      {busy && (
        <div
          role="status"
          className="rounded-lg bg-content/5 p-3 text-xs text-content/60"
        >
          {t("Working…")}
          {progress > 0 ? ` ${progress} / ${selected.size}` : ""}
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-content/10">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-content/40" />
          </div>
        </div>
      )}
      {status && <p role="status">{t(status)}</p>}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-content/10 bg-content/[0.025] px-3 py-2 text-xs [&_button]:rounded-md [&_button]:px-2 [&_button]:py-1 [&_button]:transition-colors [&_button:hover]:bg-content/10 [&_button:disabled]:opacity-35">
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
            className={`flex items-start gap-3 rounded-xl border p-4 transition-colors ${selected.has(c.id) ? "border-content/25 bg-selection/50" : "border-content/10 bg-content/[0.025] hover:bg-content/5"}`}
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
                  {(
                    {
                      workbuddy: "WorkBuddy",
                      codex: "Codex",
                      claude: "Claude",
                      cursor: "Cursor",
                      minimax: "MiniMax Code",
                      opencode: "OpenCode",
                    } as Record<string, string>
                  )[c.source] ?? c.source}
                </span>
                <span className="truncate">{c.title}</span>
              </div>
              <div className="mt-1 truncate text-xs text-content/40">
                {c.source} · {c.cwd}
              </div>
            </div>
            <span className="text-xs text-content/50">
              {c.existing ? t("Imported") : `${c.turns} ${t("Messages")}`}
            </span>
            <button
              disabled={busy}
              type="button"
              title={t("Preview task")}
              aria-label={t("Preview task")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBusy(true);
                void invoke<{
                  title: string;
                  blocks: { role: string; text: string }[];
                }>("task_import_read", { id: c.id })
                  .then(setPreview)
                  .catch(() => setStatus("Could not read this conversation"))
                  .finally(() => setBusy(false));
              }}
              className="rounded-lg border border-content/10 p-2 text-content/55 hover:bg-content/10"
            >
              <Eye className="size-4" />
            </button>
          </label>
        ))}
      </div>
      {!filtered.length && !busy && (
        <div className="rounded-2xl border border-dashed border-content/15 p-10 text-center">
          <ArrowDownCircle className="mx-auto size-7 text-content/25" />
          <p className="mt-3 text-sm text-content/60">
            {t(
              items.length
                ? "No matching tasks"
                : "Scan to find local conversations",
            )}
          </p>
          <p className="mt-2 text-xs text-content/40">
            Claude · Codex · MiniMax Code · Cursor · OpenCode · WorkBuddy
          </p>
        </div>
      )}
      {imported.map((s) => (
        <button
          key={s.id}
          className="block rounded-lg bg-content/5 px-4 py-2 text-sm"
          onClick={() => onOpenSession?.(s)}
        >
          {t("Open task")}: {s.title}
        </button>
      ))}
      {preview && (
        <Modal
          title={t("Preview task")}
          fitViewport
          className="bg-background-base text-content"
          onClose={() => setPreview(null)}
        >
          <div className="space-y-3 p-5">
            <h3 className="text-sm font-medium">{preview.title}</h3>
            {preview.blocks
              .filter((b) => b.role === "user" || b.role === "assistant")
              .map((b, i) => (
                <div key={i} className="rounded-xl bg-content/5 p-3">
                  <span className="text-xs text-content/45">
                    {t(b.role === "user" ? "You" : "Agent")}
                  </span>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                    {b.text}
                  </p>
                </div>
              ))}
          </div>
        </Modal>
      )}
      {result && (
        <Modal
          title={t("Import results")}
          className="bg-background-base text-content"
          onClose={() => setResult(null)}
        >
          <div className="space-y-4 p-5">
            {result.saved.length ? (
              <Check className="size-8 text-emerald-500" />
            ) : (
              <CircleAlert className="size-8 text-red-400" />
            )}
            <p className="text-sm">
              {t("Imported")}: {result.saved.length} · {t("Failed")}:{" "}
              {result.failed}
            </p>
            <p className="text-xs text-content/55">
              {t(
                result.failed
                  ? "Some tasks could not be imported. Completed imports have been kept."
                  : "Import completed. Open a task below to continue.",
              )}
            </p>
            {result.saved.map((s) => (
              <SecondaryButton
                key={s.id}
                onClick={() => {
                  setResult(null);
                  onOpenSession?.(s);
                }}
              >
                {t("Open task")}: {s.title}
              </SecondaryButton>
            ))}
            <SecondaryButton onClick={() => setResult(null)}>
              {t("Close")}
            </SecondaryButton>
          </div>
        </Modal>
      )}
    </section>
  );
}
