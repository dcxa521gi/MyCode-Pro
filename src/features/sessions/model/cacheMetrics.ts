import type { Block, TurnMetrics } from "./session";

export function latestTurnMetrics(blocks: Block[]): TurnMetrics | undefined {
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (blocks[i].role === "user" && !blocks[i].draft && blocks[i].turnMetrics)
      return blocks[i].turnMetrics;
  }
}

export function reportedCacheRate(metrics?: TurnMetrics): number | null {
  const value = metrics?.cacheHitPercent;
  return value != null && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}
