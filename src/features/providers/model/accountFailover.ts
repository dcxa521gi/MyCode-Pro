import type { Session } from "../../sessions/model/session";
import type { CandidateFact, ModelGroup } from "./modelGroups";
import { groupFingerprint, pickGroup } from "./modelGroups";

const account = (id?: string) => id || "default";
export function failoverTurnKey(session: Session): string | undefined {
  return [...session.blocks]
    .reverse()
    .find((b) => b.role === "user" && !b.internal)?.id;
}

/** One attempt per account and user turn. Reservation precedes any process or transcript mutation. */
export class AccountFailover {
  private entries = new Map<
    string,
    {
      turn: string;
      tried: Set<string>;
      stopped: boolean;
      active: boolean;
      generation: number;
    }
  >();

  stop(id: string, turn?: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.stopped = true;
      entry.generation++;
    }
    if (turn && (!entry || entry.turn !== turn))
      this.entries.set(id, {
        turn,
        tried: new Set(),
        stopped: true,
        active: false,
        generation: 0,
      });
  }

  begin(
    session: Session,
    group: ModelGroup,
    facts: Record<string, CandidateFact>,
    defaultAccountId = "default",
  ) {
    const turn = failoverTurnKey(session);
    if (
      !turn ||
      session.busy ||
      !session.usageLimit ||
      !session.providerSessionId ||
      session.pendingSwitch ||
      session.model.includes(":mycode-") ||
      session.cwd.startsWith("remote://") ||
      session.orchestrationLeadId ||
      !["claude", "codex"].includes(session.harness) ||
      !group.autoSwitchAccounts ||
      session.modelGroupId !== group.id ||
      session.harness !== group.harness
    )
      return;
    let entry = this.entries.get(session.id);
    if (!entry || entry.turn !== turn) {
      entry = {
        turn,
        tried: new Set(),
        stopped: false,
        active: false,
        generation: 0,
      };
      this.entries.set(session.id, entry);
    }
    if (entry.stopped || entry.active) return;
    entry.tried.add(account(session.providerAccountId));
    const eligible = { ...facts };
    for (const c of group.candidates) {
      if (
        c.model !== session.model ||
        entry.tried.has(account(c.accountId ?? defaultAccountId))
      )
        eligible[c.id] = { available: false, headroom: null, limited: false };
    }
    const fingerprint = groupFingerprint(group);
    const pick = pickGroup(group, eligible, { fingerprint, counters: {} });
    if (!pick) return;
    const target = account(pick.candidate.accountId ?? defaultAccountId);
    entry.tried.add(target);
    entry.active = true;
    const generation = entry.generation;
    return {
      target,
      pick,
      valid: (
        latest: Session | undefined,
        currentGroup: ModelGroup | undefined,
      ) =>
        !entry.stopped &&
        entry.generation === generation &&
        !!latest &&
        !latest.busy &&
        !!latest.usageLimit &&
        !latest.pendingSwitch &&
        latest.modelGroupId === group.id &&
        latest.providerSessionId === session.providerSessionId &&
        latest.cwd === session.cwd &&
        latest.worktreeCwd === session.worktreeCwd &&
        latest.runtimeMode === session.runtimeMode &&
        latest.harness === session.harness &&
        latest.model === session.model &&
        account(latest.providerAccountId) ===
          account(session.providerAccountId) &&
        failoverTurnKey(latest) === turn &&
        !!currentGroup &&
        groupFingerprint(currentGroup) === fingerprint,
      finish: () => {
        entry.active = false;
      },
      fail: () => {
        entry.stopped = true;
        entry.active = false;
      },
    };
  }
}
