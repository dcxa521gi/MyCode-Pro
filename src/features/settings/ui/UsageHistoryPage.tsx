import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
export type UsageRow = {
  sessionId: string;
  title: string;
  harness: string;
  model: string;
  cwd: string;
  updatedAt: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  measuredTurns: number;
  turns: number;
};
export function UsageHistoryPage() {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const refresh = () =>
    void invoke<UsageRow[]>("usage_history")
      .then((value) => setRows(Array.isArray(value) ? value : []))
      .catch(() => setError(t("Could not load usage history.")));
  useEffect(refresh, []);
  const selected = rows.filter((r) => !filter || r.harness === filter);
  const total = (key: "inputTokens" | "outputTokens" | "cacheReadTokens") =>
    selected.reduce((n, r) => n + r[key], 0).toLocaleString(locale);
  return (
    <section className="space-y-5">
      <div className="flex gap-3">
        <select
          aria-label={t("Agent")}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-content/15 bg-surface px-3 py-2"
        >
          <option value="">{t("All agents")}</option>
          {[...new Set(rows.map((r) => r.harness))].map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
        <button onClick={refresh}>{t("Refresh")}</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["Input tokens", "inputTokens"],
            ["Output tokens", "outputTokens"],
            ["Cached tokens", "cacheReadTokens"],
          ] as const
        ).map(([label, key]) => (
          <div
            key={key}
            className="rounded-xl border border-content/10 bg-content/[0.025] p-4"
          >
            <div className="text-xs text-content/50">{t(label)}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">
              {total(key)}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-content/50">
        {t(
          "Only provider-reported usage is counted. Missing usage is shown as unavailable; no prices are estimated.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Task",
                "Agent",
                "Input tokens",
                "Output tokens",
                "Updated",
              ].map((s) => (
                <th key={s} className="p-3 text-content/50">
                  {t(s)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selected.map((r) => (
              <tr
                key={`${r.sessionId}:${r.harness}:${r.model}`}
                className="border-t border-content/10"
              >
                <td className="max-w-72 truncate p-3" title={r.cwd}>
                  {r.title}
                </td>
                <td className="p-3">
                  {r.harness}
                  <div className="text-xs text-content/40">{r.model}</div>
                </td>
                <td className="p-3 tabular-nums">
                  {r.measuredTurns
                    ? r.inputTokens.toLocaleString(locale)
                    : t("Unavailable")}
                </td>
                <td className="p-3 tabular-nums">
                  {r.measuredTurns
                    ? r.outputTokens.toLocaleString(locale)
                    : t("Unavailable")}
                </td>
                <td className="p-3 text-xs">
                  {new Date(r.updatedAt).toLocaleDateString(locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function UsageSummary({ onOpen }: { onOpen: () => void }) {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<UsageRow[]>([]);
  useEffect(() => {
    const refresh = () =>
      void invoke<UsageRow[]>("usage_history")
        .then((value) => setRows(Array.isArray(value) ? value : []))
        .catch(() => {});
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);
  const measured = rows.some((r) => r.measuredTurns > 0);
  const total = rows.reduce((n, r) => n + r.inputTokens + r.outputTokens, 0);
  return (
    <button
      onClick={onOpen}
      className="mx-2 mb-2 flex items-center justify-between gap-3 rounded-lg border border-content/10 bg-content/[0.025] px-3 py-2 text-xs text-content/60"
      title={t("Usage history")}
    >
      <span>{t("Usage")}</span>
      <span className="font-medium tabular-nums text-content">
        {measured
          ? `${total.toLocaleString(locale)} tokens`
          : t("No usage yet")}
      </span>
    </button>
  );
}
