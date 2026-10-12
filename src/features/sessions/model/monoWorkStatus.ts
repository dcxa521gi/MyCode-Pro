import { formatMessage, getLocale, translate } from "../../../shared/i18n";
import { translateActivity } from "../../../shared/i18n/activity";
import { isReadTool } from "../../../integrations/harness/core/preview";
import type { Block } from "./session";
import {
  isProseBlock,
  isThinkingBlock,
  isToolBlock,
  needsApproval,
  subagentFailureSummary,
  toolCategory,
  workKind,
  workSummaryLine,
  type ActivityPhaseKind,
} from "./transcriptActivity";

const THINKING_LABELS = [
  "Thinking…",
  "Pondering…",
  "Considering…",
  "Working it through…",
];

export type MonoWorkStatus = {
  key: string;
  label: string;
  kind: ActivityPhaseKind;
  active: boolean;
};

/** A short status for the latest activity, stable across its streamed chunks. */
export function monoWorkStatus(
  blocks: Block[],
  active: boolean,
): MonoWorkStatus {
  if (!active) {
    return {
      key: "summary",
      label: subagentFailureSummary(blocks) ?? workSummaryLine(blocks),
      kind: workKind(blocks),
      active: false,
    };
  }
  const waiting = blocks.find(needsApproval);
  if (waiting) {
    return {
      key: `approval:${waiting.id}`,
      label: "Waiting for approval…",
      kind: toolCategory(waiting),
      active: true,
    };
  }
  let thought = -1;
  let latest: Block | undefined;
  for (const block of blocks) {
    if (isProseBlock(block) || isThinkingBlock(block)) {
      thought += 1;
      latest = block;
    } else if (isToolBlock(block)) {
      latest = block;
    }
  }
  if (!latest || !isToolBlock(latest)) {
    return {
      key: latest?.id ?? "thinking",
      label: THINKING_LABELS[Math.max(0, thought) % THINKING_LABELS.length],
      kind: "think",
      active: true,
    };
  }
  const kind = toolCategory(latest);
  const label = {
    run: "Running command…",
    edit: "Editing file…",
    research: isReadTool(
      latest.tool?.kind,
      latest.text || latest.tool?.title,
      latest.tool?.preview,
    )
      ? "Reading file…"
      : "Exploring project…",
    agent: "Running agent…",
    other: "Using tool…",
  }[kind];
  return { key: latest.id, label, kind, active: true };
}

/** Localize app-owned ticker grammar without changing the status used by animation. */
export function monoWorkStatusLabel(status: MonoWorkStatus): string {
  if (getLocale() !== "zh-CN") return status.label;
  const exact = translate(status.label);
  if (exact !== status.label) return exact;
  if (status.key === "background") {
    const waiting = status.label.match(/^Waiting for (\d+) background tasks…$/);
    if (waiting)
      return formatMessage("Waiting for {count} background tasks…", {
        count: waiting[1],
      });
  }
  // Only the model's app-generated summaries use activity grammar. A supplied
  // tool/user diagnostic is left verbatim, even when it starts with a verb.
  if (status.key !== "summary") return status.label;
  return status.label
    .split(" · ")
    .map((part) => {
      const failed = part.match(/^(\d+) subagents failed$/);
      if (failed)
        return formatMessage("{count} subagents failed", { count: failed[1] });
      const notes = part.match(/^(\d+) notes?$/);
      if (notes) return formatMessage("{count} notes", { count: notes[1] });
      return translateActivity(part);
    })
    .join(" · ");
}
