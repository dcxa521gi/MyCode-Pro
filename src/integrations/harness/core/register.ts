import { ensureMimoRegistered } from "../providers/mimo/mimoAdapter";
import { ensureClaudeRegistered } from "../providers/claude/claudeAdapter";
import { ensureCodexRegistered } from "../providers/codex/codexAdapter";
import { ensureCursorRegistered } from "../providers/cursor/cursorAdapter";
import { ensureGrokRegistered } from "../providers/grok/grokAdapter";
import { ensureHermesRegistered } from "../providers/hermes/hermesAdapter";
import { ensureOpenCodeRegistered } from "../providers/opencode/opencodeAdapter";
import { ensurePiRegistered } from "../providers/pi/piAdapter";

/** Register all known live harness adapters. Idempotent. */
export function registerBuiltinHarnesses(): void {
  ensureMimoRegistered();
  ensureClaudeRegistered();
  ensureCursorRegistered();
  ensureCodexRegistered();
  ensureGrokRegistered();
  ensureOpenCodeRegistered();
  ensurePiRegistered();
  ensureHermesRegistered();
}
