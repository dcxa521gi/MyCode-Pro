import { invokeChildBackend } from "../../../integrations/harness/core/child";
import { setHarnessModels } from "../../sessions/model/models";
import {
  setAcpAvailability,
  emitHarnessAvailability,
} from "../../../integrations/harness/core/availabilityState";
import { getLocale, translate } from "../../../shared/i18n";

export type AcpEngine = {
  id: string;
  name: string;
  nameZh: string;
  version: string;
  command: string;
  args: string[];
  models: { id: string; name: string }[];
  authMethodId?: string;
  enabled: boolean;
  accounts: string[];
  revision: string;
  integrity: Record<string, string>;
};
let catalog: AcpEngine[] = [];
export const ACP_ENGINES_CHANGED = "mycode:acp-engines-changed";
export const engineName = (engine: AcpEngine) =>
  getLocale() === "zh-CN" ? engine.nameZh : engine.name;
export const acpModelId = (id: string, account: string, model: string) =>
  `acp:${id}:${account}:${encodeURIComponent(model)}`;
export function parseAcpModelId(id: string) {
  const match = /^acp:([\w-]+):([\w-]+):(.+)$/.exec(id);
  if (!match) throw Error(translate("Invalid ACP model selection"));
  return {
    id: match[1],
    accountId: match[2],
    model: decodeURIComponent(match[3]),
  };
}
export async function refreshAcpEngines(): Promise<AcpEngine[]> {
  catalog = await invokeChildBackend<AcpEngine[]>("acp_plugins_list");
  const models = catalog
    .filter((e) => e.enabled)
    .flatMap((e) =>
      e.accounts.flatMap((account) =>
        e.models.map((m) => ({
          id: acpModelId(e.id, account, m.id),
          harness: "acp" as const,
          name: `${m.name} · ${account}`,
          provider: { id: e.id, name: engineName(e) },
        })),
      ),
    );
  setHarnessModels("acp", models);
  setAcpAvailability(models.length > 0);
  emitHarnessAvailability();
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(ACP_ENGINES_CHANGED));
  return catalog;
}
export async function resolveAcpModel(modelId: string) {
  const route = parseAcpModelId(modelId);
  const engines = await refreshAcpEngines();
  const engine = engines.find(
    (e) =>
      e.id === route.id &&
      e.enabled &&
      e.accounts.includes(route.accountId) &&
      e.models.some((m) => m.id === route.model),
  );
  if (!engine)
    throw Error(
      translate("ACP engine or account is unavailable. Check plugin settings."),
    );
  return { ...route, engine };
}
export async function saveAcpEngine(engine: AcpEngine) {
  await invokeChildBackend("acp_plugin_save", { engine });
  return refreshAcpEngines();
}
export async function removeAcpEngine(id: string) {
  await invokeChildBackend("acp_plugin_remove", { id });
  return refreshAcpEngines();
}
export async function setAcpEngineEnabled(id: string, enabled: boolean) {
  await invokeChildBackend("acp_plugin_set_enabled", { id, enabled });
  return refreshAcpEngines();
}
