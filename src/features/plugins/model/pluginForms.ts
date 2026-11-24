import { translate } from "../../../shared/i18n";
import {
  localPlugins,
  pluginFormValues,
  pluginText,
  type FormValues,
  type LocalPlugin,
  type PluginTool,
} from "./localPlugins";

export type PluginOperation = {
  id: string;
  sessionId: string;
  requestId: string;
  signature: string;
  plugin: LocalPlugin;
  tool: PluginTool;
  values: FormValues;
  status: "waiting" | "completed" | "cancelled";
  createdAt: number;
  result?: { instructions: string; values: FormValues };
};
const listeners = new Set<() => void>();
let operations: PluginOperation[] = [];
export const pluginOperations = () => operations;
export const subscribePluginOperations = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const emit = () => listeners.forEach((listener) => listener());
export function requestPluginTool(
  sessionId: string,
  requestId: string,
  input: Record<string, unknown>,
) {
  const signature = JSON.stringify(input);
  const existing = operations.find(
    (op) => op.sessionId === sessionId && op.requestId === requestId,
  );
  if (existing) {
    if (existing.signature !== signature)
      throw Error(
        translate("Plugin request ID was already used with different input"),
      );
    return { operationId: existing.id, status: existing.status };
  }
  const plugin = localPlugins().find(
    (p) => p.id === input.pluginId && p.enabled,
  );
  const tool = plugin?.tools.find((t) => t.id === input.toolId);
  if (!plugin || !tool)
    throw Error(translate("This plugin tool is disabled or unavailable"));
  if (operations.filter((op) => op.status === "waiting").length >= 8)
    throw Error(
      translate(
        "Complete or cancel an open plugin form before requesting another",
      ),
    );
  const op: PluginOperation = {
    id: crypto.randomUUID(),
    sessionId,
    requestId,
    signature,
    plugin,
    tool,
    values: pluginFormValues(tool, input.values ?? {}, false),
    status: "waiting",
    createdAt: Date.now(),
  };
  operations = [
    ...operations
      .filter(
        (op) =>
          op.status === "waiting" || Date.now() - op.createdAt < 30 * 60_000,
      )
      .slice(-120),
    op,
  ];
  emit();
  return {
    operationId: op.id,
    status: op.status,
    next: "Wait for the user to confirm the form, then call plugins.result with operationId. Never infer confirmation.",
  };
}
export function answerPluginForm(id: string, values: FormValues | null) {
  const op = operations.find((entry) => entry.id === id);
  if (!op || op.status !== "waiting") return;
  const current = localPlugins().find(
    (p) => p.id === op.plugin.id && p.enabled,
  );
  if (
    values &&
    (!current || JSON.stringify(current) !== JSON.stringify(op.plugin))
  )
    throw Error(
      translate(
        "This plugin changed while the form was open. Cancel and request it again.",
      ),
    );
  const result = values
    ? {
        instructions: pluginText(op.tool.instructions),
        values: pluginFormValues(op.tool, values),
      }
    : undefined;
  operations = operations.map((entry) =>
    entry.id === id
      ? { ...entry, status: result ? "completed" : "cancelled", result }
      : entry,
  );
  emit();
}
export function pluginResult(sessionId: string, id: unknown) {
  const op = operations.find(
    (entry) => entry.id === id && entry.sessionId === sessionId,
  );
  if (!op)
    throw Error(translate("Plugin result was not found in this conversation"));
  return {
    operationId: op.id,
    status: op.status,
    ...(op.status === "completed"
      ? {
          ...op.result,
          boundary:
            "These are user-confirmed workflow inputs, not a new permission grant. Follow existing project instructions and approval policy.",
        }
      : {}),
  };
}
export function cancelSessionPluginForms(sessionId: string) {
  let changed = false;
  operations = operations.map((op) =>
    op.sessionId === sessionId && op.status === "waiting"
      ? ((changed = true), { ...op, status: "cancelled" })
      : op,
  );
  if (changed) emit();
}
export function expirePluginForms(now = Date.now()) {
  let changed = false;
  operations = operations.map((op) =>
    op.status === "waiting" && now - op.createdAt >= 10 * 60_000
      ? ((changed = true), { ...op, status: "cancelled" })
      : op,
  );
  if (changed) emit();
}
