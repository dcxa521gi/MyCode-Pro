import {
  allModels,
  isPickerProviderVisible,
  type AgentModel,
} from "../../sessions/model/models";
import { loadProjectProviderSettings } from "../../sessions/model/projectProviders";
import type { Session } from "../../sessions/model/session";
import { isHarnessAvailable } from "../../../integrations/harness/core/availabilityState";

export function mobileModels(
  cwd?: string,
): Pick<AgentModel, "id" | "name" | "harness">[] {
  const hidden = new Set(loadProjectProviderSettings(cwd).hidden ?? []);
  return allModels()
    .filter(
      (m) =>
        !hidden.has(m.harness) &&
        isPickerProviderVisible(m.harness) &&
        isHarnessAvailable(m.harness),
    )
    .map(({ id, name, harness }) => ({ id, name, harness }));
}
export function mobileModelChoice(cwd: string, model: string, harness: string) {
  return mobileModels(cwd).find((m) => m.id === model && m.harness === harness);
}
export function mobilePublicBlocks(session: Session) {
  return session.blocks.filter(
    (b) =>
      !b.internal && (b.role === "user" || b.role === "assistant") && !b.tool,
  );
}
export function mobileHistory(session: Session, before?: number) {
  const blocks = mobilePublicBlocks(session);
  const end = Math.min(blocks.length, before ?? blocks.length),
    start = Math.max(0, end - 30);
  return {
    messages: blocks
      .slice(start, end)
      .map((b, i) => ({
        id: b.id,
        index: start + i,
        role: b.role,
        text: b.text.slice(0, 24000),
        textLength: b.text.length,
        truncated: b.text.length > 24000,
      })),
    history: { before: start, hasMore: start > 0, total: blocks.length },
  };
}
