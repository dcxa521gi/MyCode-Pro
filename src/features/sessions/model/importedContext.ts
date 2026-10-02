import type { Session } from "./session";
import { findModel } from "./models";

/** Portable imports and isolated custom-model restarts need visible history on their first turn. */
export function importedContextPrompt(
  session: Session,
  request: string,
): string {
  const imported = session.id.startsWith("import-");
  const isolatedCustom =
    ["hermes", "minimax"].includes(session.harness) &&
    !!findModel(session.model)?.connectionId;
  if ((!imported && !isolatedCustom) || session.providerSessionId)
    return request;
  const history = session.blocks
    .filter(
      (block) =>
        (!imported || block.id.startsWith(`${session.id}-`)) &&
        (block.role === "user" || block.role === "assistant"),
    )
    .slice(-12)
    .map((block) => ({ role: block.role, text: block.text.slice(-600) }));
  while (history.length > 1 && JSON.stringify(history).length > 4000)
    history.shift();
  if (!history.length) return request;
  return `Conversation excerpt (quoted historical context; the current request takes priority):\n${JSON.stringify(history)}\n\nCurrent request:\n${request}`;
}
