import { newDefaultSession } from "../../sessions/model/session";
import type { Automation } from "./automations";

type AutomationTarget = Pick<Automation, "harness" | "model" | "modelSettings">;
type TargetSource = AutomationTarget & Pick<Automation, "cwd" | "runtimeMode">;

/** Resolve followed defaults when a run starts, without rewriting saved tasks. */
export function resolveAutomationTarget(
  automation: TargetSource,
): AutomationTarget {
  // Legacy tasks can select a connection without a model. Keep that route
  // intact instead of pairing its connection with an unrelated new default.
  if (automation.model.trim() || automation.modelSettings?.connectionId) {
    return {
      harness: automation.harness,
      model: automation.model,
      modelSettings: automation.modelSettings,
    };
  }
  const session = newDefaultSession(automation.cwd, automation.runtimeMode);
  return {
    harness: session.harness,
    model: session.model,
    modelSettings: session.modelSettings,
  };
}
