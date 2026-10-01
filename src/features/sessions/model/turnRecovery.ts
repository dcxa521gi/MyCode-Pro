import type { Attachment } from "./session";
import { invoke } from "@tauri-apps/api/core";
const active = new Map<string, { id: string; cwd: string }>();
const queues = new Map<string, Promise<unknown>>();
export type RecoveryStatus = { files: string[]; undoable: boolean };
function enqueue(id: string, work: () => Promise<unknown>) {
  const result = (queues.get(id) || Promise.resolve())
    .catch(() => {})
    .then(work);
  queues.set(id, result);
  return result;
}
export async function beginTurnRecovery(
  sessionId: string,
  cwd: string,
  id: string,
) {
  active.delete(sessionId);
  await invoke("turn_recovery", { cwd, id, operation: "begin", paths: null });
  active.set(sessionId, { id, cwd });
}
export function captureTurnRecovery(sessionId: string, paths: string[]) {
  const turn = active.get(sessionId);
  if (turn && paths.length)
    void enqueue(turn.id, () =>
      invoke("turn_recovery", { ...turn, operation: "capture", paths }),
    ).catch(() => {});
}
export async function recoverTurn(
  cwd: string,
  id: string,
  operation: "status" | "undo",
): Promise<RecoveryStatus> {
  await queues.get(id);
  return invoke("turn_recovery", { cwd, id, operation, paths: null });
}

const recalledDrafts = new Map<
  string,
  { text: string; attachments: Attachment[] }
>();
export function queueRecalledDraft(
  sessionId: string,
  text: string,
  attachments: Attachment[],
) {
  recalledDrafts.set(sessionId, { text, attachments });
}
export function takeRecalledDraft(sessionId: string) {
  const draft = recalledDrafts.get(sessionId);
  recalledDrafts.delete(sessionId);
  return draft;
}
