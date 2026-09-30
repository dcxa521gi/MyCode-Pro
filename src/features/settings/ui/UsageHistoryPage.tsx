import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "../../../shared/i18n";
export type UsageRow = {
  sessionId: string;
  title: string;
  harness: string;
  model: string;
  connectionId?: string;
  cwd: string;
  updatedAt: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cacheEligibleTokens?: number;
  cacheMeasuredReadTokens?: number;
  measuredTurns: number;
  turns: number;
};
const tokens = (row: UsageRow) => row.inputTokens + row.outputTokens;
const dayKey = (time: number) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function UsageHistoryPage() {
  const { t, locale } = useTranslation();
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [range, setRange] = useState("30");
  const [day, setDay] = useState("");
  const [group, setGroup] = useState<"model" | "harness" | "sessionId">(
    "model",
  );
  const [page, setPage] = useState(0);
  const refresh = () => {
    setError("");
    void invoke<UsageRow[]>("usage_history_turns")
      .then((value) => setRows(Array.isArray(value) ? value : []))
      .catch(() => setError(t("Could not load usage history.")));
  };
  useEffect(refresh, []);
  const today = dayKey(Date.now());
  const windowDays = Array.from({ length: 140 }, (_, index) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 139 + index);
    return dayKey(d.getTime());
  });
  const base = rows.filter((r) => !filter || r.harness === filter);
  const totals = new Map<string, number>();
  for (const row of base)
    if (row.updatedAt > 0) {
      const date = dayKey(row.updatedAt);
      totals.set(date, (totals.get(date) || 0) + tokens(row));
    }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Number(range) + 1);
  const selected = base.filter((r) =>
    day
      ? r.updatedAt > 0 && dayKey(r.updatedAt) === day
      : range === "all" || r.updatedAt >= start.getTime(),
  );
  const grouped = new Map<
    string,
    {
      name: string;
      detail: string;
      input: number;
      output: number;
      cached: number;
      turns: number;
    }
  >();
  for (const row of selected) {
    const id =
      group === "model"
        ? `${row.harness}:${row.connectionId || ""}:${row.model}`
        : row[group];
    const item = grouped.get(id) || {
      name: group === "sessionId" ? row.title : row[group],
      detail:
        group === "model" ? row.harness : group === "sessionId" ? row.cwd : "",
      input: 0,
      output: 0,
      cached: 0,
      turns: 0,
    };
    item.input += row.inputTokens;
    item.output += row.outputTokens;
    item.cached += row.cacheReadTokens;
    item.turns += row.measuredTurns;
    grouped.set(id, item);
  }
  const breakdown = [...grouped.entries()].sort(
    (a, b) => b[1].input + b[1].output - a[1].input - a[1].output,
  );
  const modelDaily = new Map<string, Map<string, number>>();
  const modelNames = [
    ...new Set(rows.map((row) => `${row.harness} · ${row.model}`)),
  ].sort();
  for (const row of base) {
    if (row.updatedAt <= 0) continue;
    const date = dayKey(row.updatedAt),
      name = `${row.harness} · ${row.model}`;
    const daily = modelDaily.get(date) || new Map<string, number>();
    daily.set(name, (daily.get(name) || 0) + tokens(row));
    modelDaily.set(date, daily);
  }
  let streak = 0;
  for (const date of windowDays.slice().reverse()) {
    if (!totals.get(date)) {
      if (date === today) continue;
      break;
    }
    streak++;
  }
  const max = Math.max(1, ...totals.values());
  const total = selected.reduce((sum, r) => sum + tokens(r), 0);
  const card = "rounded-xl bg-content/[0.035] p-4";
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select
          aria-label={t("Agent")}
          className="rounded-lg bg-surface px-3 py-2"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(0);
          }}
        >
          <option value="">{t("All agents")}</option>
          {[...new Set(rows.map((r) => r.harness))].map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
        <select
          aria-label={t("Date range")}
          className="rounded-lg bg-surface px-3 py-2"
          value={range}
          onChange={(e) => {
            setRange(e.target.value);
            setDay("");
            setPage(0);
          }}
        >
          {[
            ["1", "Today"],
            ["7", "Last 7 days"],
            ["30", "Last 30 days"],
            ["all", "All time"],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
        <input
          type="date"
          aria-label={t("Date")}
          max={today}
          value={day}
          className="rounded-lg bg-surface px-3 py-2"
          onChange={(e) => {
            if (e.target.value <= today) {
              setDay(e.target.value);
              setPage(0);
            }
          }}
        />
        <button
          onClick={refresh}
          className="ml-auto rounded-lg bg-content/5 px-3 py-2"
        >
          {t("Refresh")}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total tokens", total],
          ["Input tokens", selected.reduce((n, r) => n + r.inputTokens, 0)],
          ["Output tokens", selected.reduce((n, r) => n + r.outputTokens, 0)],
          [
            "Active days",
            new Set(
              selected
                .filter((r) => r.updatedAt > 0 && tokens(r) > 0)
                .map((r) => dayKey(r.updatedAt)),
            ).size,
          ],
        ].map(([label, value]) => (
          <div key={label} className={card}>
            <p className="text-xs text-content/55">{t(String(label))}</p>
            <strong className="mt-2 block text-base tabular-nums">
              {Number(value).toLocaleString(locale)}
            </strong>
          </div>
        ))}
      </div>
      <div className={card}>
        <h3 className="mb-3 flex justify-between text-sm">
          <span>{t("Activity · last 20 weeks")}</span>
          <span className="text-xs text-content/55">
            {t("Consecutive active days")}: {streak}
          </span>
        </h3>
        <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto">
          {windowDays.map((date) => (
            <button
              key={date}
              aria-label={`${date}: ${(totals.get(date) || 0).toLocaleString(locale)} tokens`}
              title={`${date}: ${(totals.get(date) || 0).toLocaleString(locale)}`}
              onClick={() => {
                setDay(date);
                setPage(0);
              }}
              className={`h-3 min-w-3 rounded-sm focus-visible:outline-2 focus-visible:outline-accent ${date === day ? "ring-1 ring-content" : ""}`}
              style={{
                backgroundColor: `color-mix(in srgb, var(--color-accent, #b89166) ${totals.get(date) ? 20 + (80 * (totals.get(date) || 0)) / max : 8}%, var(--color-surface, #292724))`,
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-content/55">
          <span>{windowDays[0]}</span>
          <span>{today}</span>
        </div>
      </div>
      <div className={card}>
        <h3 className="mb-3 text-sm">{t("Daily tokens · last 30 days")}</h3>
        <div className="flex h-28 items-end gap-1">
          {windowDays.slice(-30).map((date) => (
            <button
              key={date}
              title={`${date}: ${(totals.get(date) || 0).toLocaleString(locale)}`}
              aria-label={`${date}: ${totals.get(date) || 0} tokens`}
              onClick={() => {
                setDay(date);
                setPage(0);
              }}
              className="flex min-h-1 flex-1 flex-col-reverse overflow-hidden rounded-t-sm bg-content/5 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-content"
              style={{
                height: `${Math.max(2, ((totals.get(date) || 0) / max) * 100)}%`,
              }}
            >
              {[...(modelDaily.get(date) || [])].map(([name, value]) => (
                <span
                  key={name}
                  title={`${name}: ${value.toLocaleString(locale)}`}
                  className="block w-full"
                  style={{
                    height: `${(value / (totals.get(date) || 1)) * 100}%`,
                    backgroundColor: `oklch(65% 0.12 ${(modelNames.indexOf(name) * 137.5 + 65) % 360})`,
                  }}
                />
              ))}
            </button>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-content/55">
          <span>{windowDays[110]}</span>
          <span>{today}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-content/65">
          {modelNames
            .filter((name) =>
              windowDays
                .slice(-30)
                .some((date) => modelDaily.get(date)?.has(name)),
            )
            .map((name) => (
              <span key={name} className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: `oklch(65% 0.12 ${(modelNames.indexOf(name) * 137.5 + 65) % 360})`,
                  }}
                />
                {name}
              </span>
            ))}
        </div>
      </div>
      <div className={card}>
        <div className="mb-4 flex gap-2">
          {(
            [
              ["model", "By model"],
              ["harness", "By agent"],
              ["sessionId", "By task"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              aria-pressed={group === id}
              onClick={() => {
                setGroup(id);
                setPage(0);
              }}
              className={`rounded-full px-3 py-1 text-xs ${group === id ? "bg-accent/15 text-accent" : "bg-content/5"}`}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Name",
                  "Input tokens",
                  "Output tokens",
                  "Cached tokens",
                  "Share",
                ].map((label) => (
                  <th
                    key={label}
                    className="p-2 text-xs font-medium text-content/55"
                  >
                    {t(label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breakdown.slice(page * 20, page * 20 + 20).map(([id, row]) => (
                <tr key={id} className="border-t border-content/5">
                  <td className="max-w-64 truncate p-2" title={row.name}>
                    {row.name}
                    <p className="truncate text-xs text-content/45">
                      {row.detail}
                    </p>
                  </td>
                  {[row.input, row.output, row.cached].map((v, i) => (
                    <td key={i} className="p-2 tabular-nums">
                      {row.turns ? v.toLocaleString(locale) : t("Unavailable")}
                    </td>
                  ))}
                  <td className="p-2 tabular-nums">
                    {total
                      ? (((row.input + row.output) / total) * 100).toFixed(1)
                      : "0"}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex justify-end gap-3 text-xs">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            {t("Previous")}
          </button>
          <span>
            {page + 1} / {Math.max(1, Math.ceil(breakdown.length / 20))}
          </span>
          <button
            disabled={(page + 1) * 20 >= breakdown.length}
            onClick={() => setPage(page + 1)}
          >
            {t("Next")}
          </button>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-content/50">
        {t(
          "Only provider-reported local usage is counted. Turns without dates appear only in All time. Missing usage is not estimated.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
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
