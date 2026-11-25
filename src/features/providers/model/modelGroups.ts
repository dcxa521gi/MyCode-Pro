import { translate } from "../../../shared/i18n";
import { HARNESSES, type HarnessId } from "../../sessions/model/session";

/** Cindy 050bcaea97 scheduling semantics, adapted to MyCode's isolated CLI accounts. */
export type GroupStrategy =
  "order" | "rotate" | "drain" | "headroom" | "weighted";
export type GroupCandidate = {
  id: string;
  model: string;
  accountId?: string;
  weight: number;
  enabled: boolean;
};
export type GroupException = {
  days: number[];
  start: string;
  end: string;
  strategy: GroupStrategy;
};
export type ModelGroup = {
  id: string;
  name: string;
  harness: HarnessId;
  strategy: GroupStrategy;
  candidates: GroupCandidate[];
  exceptions: GroupException[];
  /** Explicit permission to carry a quota-limited native conversation to another account. */
  autoSwitchAccounts?: boolean;
};
export type GroupConfig = {
  version: 1;
  groups: ModelGroup[];
  defaults: Partial<Record<HarnessId, string>>;
};
export type CandidateFact = {
  available: boolean;
  headroom: number | null;
  limited: boolean;
  reason?: string;
};
export type GroupCursor = {
  fingerprint: string;
  last?: string;
  counters: Record<string, number>;
};
export type GroupPick = {
  candidate: GroupCandidate;
  strategy: GroupStrategy;
  cursor: GroupCursor;
  trace: { id: string; reason: string }[];
};
const KEY = "mycode.modelGroups.v1";
const CURSORS = "mycode.modelGroupCursors.v1";
export const MODEL_GROUPS_CHANGED = "mycode:model-groups-changed";
export const GROUP_STRATEGIES: GroupStrategy[] = [
  "order",
  "rotate",
  "drain",
  "headroom",
  "weighted",
];
export const GROUP_STRATEGY_LABELS: Record<GroupStrategy, string> = {
  order: "In order",
  rotate: "Round robin",
  drain: "Use until exhausted",
  headroom: "Most quota remaining",
  weighted: "Weighted rotation",
};
const clock = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minute = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export function groupStrategyAt(group: ModelGroup, now: Date): GroupStrategy {
  const time = now.getHours() * 60 + now.getMinutes();
  for (const rule of group.exceptions) {
    const start = minute(rule.start),
      end = minute(rule.end);
    const overnight = start > end;
    const day = overnight && time < end ? (now.getDay() + 6) % 7 : now.getDay();
    if (
      rule.days.includes(day) &&
      (overnight ? time >= start || time < end : time >= start && time < end)
    )
      return rule.strategy;
  }
  return group.strategy;
}
export function groupFingerprint(group: ModelGroup): string {
  return JSON.stringify([
    group.harness,
    group.strategy,
    group.candidates,
    group.exceptions,
    group.autoSwitchAccounts === true,
  ]);
}
export function validateGroup(group: ModelGroup): void {
  if (
    !group.id ||
    !group.name.trim() ||
    !HARNESSES.includes(group.harness) ||
    !GROUP_STRATEGIES.includes(group.strategy)
  )
    throw Error(translate("Invalid model group"));
  if (
    !group.candidates.length ||
    group.candidates.length > 64 ||
    new Set(group.candidates.map((c) => c.id)).size !== group.candidates.length
  )
    throw Error(translate("Choose between 1 and 64 model sources"));
  for (const c of group.candidates)
    if (
      !c.id ||
      !c.model.startsWith(`${group.harness}:`) ||
      !Number.isInteger(c.weight) ||
      c.weight < 1 ||
      c.weight > 100
    )
      throw Error(translate("Model source weights must be between 1 and 100"));
  if (
    group.exceptions.length > 32 ||
    group.exceptions.some(
      (r) =>
        !clock(r.start) ||
        !clock(r.end) ||
        r.start === r.end ||
        !r.days.length ||
        r.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
        !GROUP_STRATEGIES.includes(r.strategy),
    )
  )
    throw Error(translate("Check the weekdays and time range"));
}
export function loadGroupConfig(): GroupConfig {
  try {
    const data = JSON.parse(
      localStorage.getItem(KEY) || "null",
    ) as GroupConfig | null;
    if (data?.version !== 1 || !Array.isArray(data.groups))
      return { version: 1, groups: [], defaults: {} };
    const groups = data.groups.filter((g) => {
      try {
        validateGroup(g);
        return true;
      } catch {
        return false;
      }
    });
    return { version: 1, groups, defaults: data.defaults ?? {} };
  } catch {
    return { version: 1, groups: [], defaults: {} };
  }
}
export function saveGroupConfig(config: GroupConfig): void {
  config.groups.forEach(validateGroup);
  if (new Set(config.groups.map((g) => g.id)).size !== config.groups.length)
    throw Error(translate("Invalid model group"));
  localStorage.setItem(KEY, JSON.stringify(config));
  window.dispatchEvent(new Event(MODEL_GROUPS_CHANGED));
}
export function readGroupCursor(group: ModelGroup): GroupCursor {
  const fingerprint = groupFingerprint(group);
  try {
    const cursor = JSON.parse(localStorage.getItem(CURSORS) || "{}")[
      group.id
    ] as GroupCursor | undefined;
    if (
      cursor?.fingerprint === fingerprint &&
      cursor.counters &&
      Object.values(cursor.counters).every(Number.isFinite)
    )
      return cursor;
  } catch {
    /* A corrupt counter must not block a conversation. */
  }
  return { fingerprint, counters: {} };
}
/** Pure preview: rejected submissions never advance account or weighted counters. */
export function pickGroup(
  group: ModelGroup,
  facts: Record<string, CandidateFact>,
  previous: GroupCursor,
  now = new Date(),
): GroupPick | null {
  const fingerprint = groupFingerprint(group);
  const cursor =
    previous.fingerprint === fingerprint
      ? previous
      : { fingerprint, counters: {} };
  const ready = group.candidates.filter(
    (c) => c.enabled && facts[c.id]?.available && !facts[c.id]?.limited,
  );
  if (!ready.length) return null;
  const strategy = groupStrategyAt(group, now);
  const last = group.candidates.findIndex((c) => c.id === cursor.last);
  let candidate = ready[0];
  const counters = { ...cursor.counters };
  if (strategy === "drain" || strategy === "rotate")
    candidate =
      (strategy === "drain"
        ? ready.find((c) => c.id === cursor.last)
        : undefined) ??
      ready.find((c) => group.candidates.indexOf(c) > last) ??
      ready[0];
  if (strategy === "headroom")
    candidate = ready.reduce((best, c) =>
      (facts[c.id].headroom ?? -1) > (facts[best.id].headroom ?? -1) ? c : best,
    );
  if (strategy === "weighted") {
    for (const c of ready) counters[c.id] = (counters[c.id] ?? 0) + c.weight;
    candidate = ready.reduce((best, c) =>
      counters[c.id] > counters[best.id] ? c : best,
    );
    counters[candidate.id] -= ready.reduce((sum, c) => sum + c.weight, 0);
  }
  return {
    candidate,
    strategy,
    cursor: { fingerprint, last: candidate.id, counters },
    trace: group.candidates.map((c) => ({
      id: c.id,
      reason:
        c.id === candidate.id
          ? "Selected"
          : !c.enabled
            ? "Disabled"
            : !facts[c.id]?.available
              ? facts[c.id]?.reason || "Unavailable"
              : facts[c.id]?.limited
                ? "Exhausted"
                : "Standby",
    })),
  };
}
export function commitGroupPick(group: ModelGroup, pick: GroupPick): void {
  // A configuration edited while a send was being prepared must not receive old counters.
  const latest = loadGroupConfig().groups.find((g) => g.id === group.id);
  if (!latest || groupFingerprint(latest) !== pick.cursor.fingerprint) return;
  let cursors: Record<string, GroupCursor> = {};
  try {
    cursors = JSON.parse(localStorage.getItem(CURSORS) || "{}");
  } catch {
    /* reset malformed cache */
  }
  cursors[group.id] = pick.cursor;
  localStorage.setItem(CURSORS, JSON.stringify(cursors));
}
