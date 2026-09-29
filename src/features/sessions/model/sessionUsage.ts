import { invoke } from "@tauri-apps/api/core";
import type { UsageRow } from "../../settings/ui/UsageHistoryPage";
let cached = new Map<string, number | null>();
let updated = 0;
let inflight: Promise<void> | null = null;
export async function sessionTokenTotal(id: string): Promise<number | null> {
  if (Date.now() - updated > 15_000) {
    inflight ??= invoke<UsageRow[]>("usage_history")
      .then((rows) => {
        const next = new Map<string, number | null>();
        for (const row of rows) {
          const previous = next.get(row.sessionId) ?? null;
          next.set(
            row.sessionId,
            row.measuredTurns > 0
              ? (previous ?? 0) + row.inputTokens + row.outputTokens
              : previous,
          );
        }
        cached = next;
        updated = Date.now();
      })
      .finally(() => {
        inflight = null;
      });
    await inflight;
  }
  return cached.get(id) ?? null;
}
