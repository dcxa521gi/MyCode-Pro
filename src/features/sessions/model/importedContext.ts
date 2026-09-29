import type { Session } from "./session";

/** Portable imports have no resumable provider state. Seed their first turn. */
export function importedContextPrompt(
  session: Session,
  request: string,
): string {
  if (!session.id.startsWith("import-") || session.providerSessionId)
    return request;
  const history = session.blocks
    .filter(
      (block) =>
        block.id.startsWith(`${session.id}-`) &&
        (block.role === "user" || block.role === "assistant"),
    )
    .slice(-12)
    .map((block) => ({ role: block.role, text: block.text.slice(-600) }));
  while (history.length > 1 && JSON.stringify(history).length > 4000)
    history.shift();
  if (!history.length) return request;
  return `Imported conversation excerpt (quoted historical context; the current request takes priority):\n${JSON.stringify(history)}\n\nCurrent request:\n${request}`;
}
