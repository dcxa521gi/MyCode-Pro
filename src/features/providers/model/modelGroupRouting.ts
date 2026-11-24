import { translate } from "../../../shared/i18n";
import { isHarnessAvailable } from "../../../integrations/harness/core/availabilityState";
import { modelsFor, type AgentModel } from "../../sessions/model/models";
import type { Session } from "../../sessions/model/session";
import { getCachedRateLimits, loadRateLimits } from "./rateLimitsCache";
import type { RateLimitWindow } from "./rateLimits";
import {
  providerAccountExists,
  selectedProviderAccountId,
  supportsProviderAccounts,
} from "./providerAccounts";
import {
  loadGroupConfig,
  pickGroup,
  readGroupCursor,
  type CandidateFact,
  type ModelGroup,
  type GroupPick,
} from "./modelGroups";

export type ModelGroupRoute = {
  group: ModelGroup;
  pick: GroupPick;
  model: AgentModel;
  accountId?: string;
};
export function modelGroupFacts(
  group: ModelGroup,
  cwd: string,
  now = Date.now(),
): Record<string, CandidateFact> {
  const models = modelsFor(group.harness);
  return Object.fromEntries(
    group.candidates.map((c) => {
      const model = models.find((m) => m.id === c.model);
      const accountId =
        c.accountId ??
        (supportsProviderAccounts(group.harness)
          ? selectedProviderAccountId(group.harness, cwd)
          : undefined);
      const exists =
        !!model?.connectionId ||
        !accountId ||
        (supportsProviderAccounts(group.harness) &&
          providerAccountExists(group.harness, accountId));
      // API-key sources use the provider connection's key, never a subscription's quota.
      const limits =
        !model?.connectionId && supportsProviderAccounts(group.harness)
          ? getCachedRateLimits(group.harness, accountId)
          : undefined;
      const fresh =
        limits?.status === "ok" && now - limits.updatedAt <= 5 * 60_000;
      const windows = fresh
        ? [limits.session, limits.weekly, limits.monthly].filter(
            (w): w is RateLimitWindow =>
              w != null && (w.resetsAt === null || w.resetsAt > now),
          )
        : [];
      const long = windows.filter((w) => w.windowMinutes > 300);
      const quota = long.length ? long : windows;
      return [
        c.id,
        {
          available: !!model && exists && isHarnessAvailable(group.harness),
          headroom: quota.length
            ? Math.min(...quota.map((w) => Math.max(0, 100 - w.usedPercent)))
            : null,
          limited: windows.some((w) => w.usedPercent >= 100),
          reason: !exists ? "Account removed" : "Unavailable",
        },
      ];
    }),
  );
}
export async function refreshModelGroupQuotas(
  group: ModelGroup,
  cwd = "",
): Promise<void> {
  const harness = group.harness;
  if (!supportsProviderAccounts(harness)) return;
  const accounts = [
    ...new Set(
      group.candidates
        .filter(
          (c) =>
            !modelsFor(harness).find((m) => m.id === c.model)?.connectionId,
        )
        .map((c) => c.accountId ?? selectedProviderAccountId(harness, cwd)),
    ),
  ];
  await Promise.all(
    accounts
      .filter((id) => providerAccountExists(harness, id))
      .map((id) => loadRateLimits(harness, id, true)),
  );
}
/** Opt-in routing is pinned on the first accepted turn. Existing conversations and managed assignments keep their explicit routes. */
export function prepareModelGroupRoute(
  session: Session,
): ModelGroupRoute | undefined {
  if (
    session.busy ||
    session.blocks.length ||
    session.providerSessionId ||
    session.pendingSwitch ||
    session.cwd.startsWith("remote://")
  )
    return;
  const config = loadGroupConfig();
  const group = config.groups.find(
    (g) =>
      g.id === config.defaults[session.harness] &&
      g.harness === session.harness,
  );
  if (!group) return;
  const pick = pickGroup(
    group,
    modelGroupFacts(group, session.cwd),
    readGroupCursor(group),
  );
  if (!pick)
    throw Error(
      translate(
        "No available source in this model group. Check accounts, quota and installed agents.",
      ),
    );
  const model = modelsFor(group.harness).find(
    (m) => m.id === pick.candidate.model,
  )!;
  return {
    group,
    pick,
    model,
    accountId: model.connectionId ? undefined : pick.candidate.accountId,
  };
}
