import type { TurnMetrics } from "../../../../features/sessions/model/session";

/** A user turn can contain several assistant messages separated by tool calls. */
export class PiTurnUsage {
  private index = 0;
  private messages = new Map<number, TurnMetrics>();
  startMessage() {
    this.index++;
  }
  reset() {
    this.index = 0;
    this.messages.clear();
  }
  update(metrics: TurnMetrics): TurnMetrics {
    this.messages.set(this.index, metrics);
    const total: TurnMetrics = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    for (const message of this.messages.values()) {
      total.inputTokens! += message.inputTokens ?? 0;
      total.outputTokens! += message.outputTokens ?? 0;
      total.cacheReadTokens! += message.cacheReadTokens ?? 0;
      total.cacheWriteTokens! += message.cacheWriteTokens ?? 0;
    }
    const input =
      total.inputTokens! + total.cacheReadTokens! + total.cacheWriteTokens!;
    if (
      input &&
      [...this.messages.values()].some((m) => m.cacheHitPercent != null)
    )
      total.cacheHitPercent = (total.cacheReadTokens! / input) * 100;
    return total;
  }
}
