import type { HarnessId } from "../../sessions/model/session";
import { IM_CHANNELS } from "./imCompletion";
type Origin = {
  sessionId: string;
  cwd: string;
  harness: HarnessId;
  channel: string;
  ownerId: string;
};
type Wake = Omit<Origin, "channel" | "ownerId"> & { text: string };
export type IMProviderWake = Origin & { text: string };
/** Identity of one explicit turn binding; replacing it revokes earlier wakes. */
export type IMTurnOriginLease = Readonly<Origin>;
const origins = new Map<string, Origin>();
const listeners = new Set<(wake: IMProviderWake) => void>();

/** An explicit desktop turn clears this binding; credentials stay in the bridge. */
export function bindIMTurnOrigin(origin: Origin): void {
  if (!IM_CHANNELS.includes(origin.channel as (typeof IM_CHANNELS)[number]))
    return;
  origins.set(origin.sessionId, { ...origin });
}
export function clearIMTurnOrigin(sessionId: string): void {
  origins.delete(sessionId);
}
export function captureIMTurnOrigin(
  sessionId: string,
): IMTurnOriginLease | undefined {
  return origins.get(sessionId);
}
export function subscribeIMProviderWake(
  listener: (wake: IMProviderWake) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** Only provider-authored successful final text may reach this boundary. */
export function publishIMProviderWake(
  wake: Wake,
  lease: IMTurnOriginLease | undefined,
): void {
  const origin = origins.get(wake.sessionId);
  if (
    !origin ||
    origin !== lease ||
    origin.cwd !== wake.cwd ||
    origin.harness !== wake.harness ||
    !wake.text.trim()
  )
    return;
  const event = { ...origin, text: wake.text.trim().slice(-3000) };
  for (const listener of listeners) listener(event);
}
