/** Codex input includes cached reads; the other normalized harnesses split them out. */
export function usageTokens(row: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  harness: string;
}) {
  return (
    row.inputTokens +
    row.outputTokens +
    row.cacheWriteTokens +
    (row.harness === "codex" ? 0 : row.cacheReadTokens)
  );
}
