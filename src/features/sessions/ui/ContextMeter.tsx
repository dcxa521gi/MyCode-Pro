import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../shared/i18n";
import {
  contextRatio,
  formatTokens,
  type ContextUsage,
} from "../model/contextUsage";
import type { TurnMetrics } from "../model/session";
import { reportedCacheRate } from "../model/cacheMetrics";
import { Popover } from "../../../shared/ui/Popover";

const autoAttempts = new Map<string, string>();
const AUTO_KEY = "mycode.autoCompact";

export function ContextMeter({
  usage,
  metrics,
  sessionId,
  onCompact,
  compactDisabled = false,
}: {
  usage?: ContextUsage;
  metrics?: TurnMetrics;
  sessionId?: string;
  onCompact?: () => boolean | void;
  compactDisabled?: boolean;
}) {
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [auto, setAuto] = useState(() => {
    try {
      return localStorage.getItem(AUTO_KEY) !== "false";
    } catch {
      return true;
    }
  });
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const refresh = () => setAuto(localStorage.getItem(AUTO_KEY) !== "false");
    window.addEventListener("mycode-auto-compact", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("mycode-auto-compact", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const ratio = contextRatio(usage);
  const cache = reportedCacheRate(metrics);
  useEffect(() => {
    if (!sessionId) return;
    if (ratio !== null && ratio < 0.85) autoAttempts.delete(sessionId);
    if (
      !auto ||
      compactDisabled ||
      !onCompact ||
      ratio === null ||
      ratio < 0.85
    )
      return;
    const reading = `${usage?.used}:${usage?.window}`;
    if (autoAttempts.get(sessionId) === reading) return;
    autoAttempts.set(sessionId, reading);
    onCompact();
  }, [
    auto,
    compactDisabled,
    onCompact,
    ratio,
    sessionId,
    usage?.used,
    usage?.window,
  ]);
  const headline = `${t("Context usage")}: ${ratio === null ? t("Unavailable") : `${Math.round(ratio * 100)}%`}`;
  const detail = usage
    ? `${formatTokens(usage.used)} / ${usage.window ? formatTokens(usage.window) : "—"} tokens`
    : t("No usage yet");
  return (
    <div
      ref={root}
      className="relative shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        title={t("Context usage")}
        aria-label={headline}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid size-6.5 place-items-center rounded-md hover:bg-content/10 focus-visible:ring-1 focus-visible:ring-accent"
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={
            ratio !== null && ratio >= 0.9
              ? "text-red-400"
              : ratio !== null && ratio >= 0.75
                ? "text-amber-400"
                : "text-accent"
          }
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            opacity=".2"
          />
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={Math.PI * 18}
            strokeDashoffset={Math.PI * 18 * (1 - (ratio ?? 0))}
            transform="rotate(-90 12 12)"
          />
        </svg>
      </button>
      {(open || hovered) && (
        <Popover
          anchor={root}
          side="top"
          align="end"
          onDismiss={open ? () => setOpen(false) : undefined}
          className={`w-64 space-y-2 p-3 ${open ? "" : "pointer-events-none"}`}
        >
          <div className="text-xs">{headline}</div>
          <div className="text-xs text-content/55">{detail}</div>
          <div className="text-xs">
            {t("Cache hit rate")}:{" "}
            {cache === null ? t("Unavailable") : `${cache.toFixed(1)}%`}
          </div>
          <div className="text-xs text-content/55">
            {t("Cached tokens")}:{" "}
            {metrics?.cacheReadTokens?.toLocaleString(locale) ??
              (cache === 0 ? "0" : "—")}
          </div>
          <div className="text-xs text-content/55">
            {t("Output tokens")}:{" "}
            {metrics?.outputTokens?.toLocaleString(locale) ?? "—"}
          </div>
          <p className="text-[11px] text-content/45">
            {t(
              "Context is the latest reported occupancy. Cache statistics describe the latest measured turn.",
            )}
          </p>
          {open &&
            (onCompact ? (
              <>
                <label className="flex gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={auto}
                    onChange={(e) => {
                      setAuto(e.target.checked);
                      localStorage.setItem(AUTO_KEY, String(e.target.checked));
                      window.dispatchEvent(new Event("mycode-auto-compact"));
                    }}
                  />
                  {t("Auto-compact at 85%")}
                </label>
                <button
                  type="button"
                  disabled={compactDisabled || !usage?.used}
                  onClick={() => {
                    setOpen(false);
                    onCompact();
                  }}
                  className="w-full rounded-md bg-content/10 px-2 py-1.5 text-xs disabled:opacity-40"
                >
                  {t("Compact now")}
                </button>
              </>
            ) : (
              <p className="text-xs text-content/50">
                {t(
                  "This agent manages its own context and does not expose manual compaction.",
                )}
              </p>
            ))}
        </Popover>
      )}
    </div>
  );
}
