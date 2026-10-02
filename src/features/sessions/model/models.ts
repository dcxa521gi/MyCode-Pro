import type { ModelConnection } from "../../providers/model/modelConnections";
import type { HarnessId } from "./session";
import { HARNESSES } from "./session";
import { loadProjectProviderSettings } from "./projectProviders";
import {
  hasProbedHarnessAvailability,
  isHarnessAvailable,
} from "../../../integrations/harness/core/availabilityState";

export type ModelSettingChoice = {
  value: string;
  label: string;
};

export type ModelSetting = {
  id: string;
  label: string;
  kind: "select" | "toggle";
  value: string;
  options: ModelSettingChoice[];
  description?: string;
};

export type AgentModel = {
  id: string;
  harness: HarnessId;
  name: string;
  nativeId?: string;
  connectionId?: string;
  primary?: boolean;
  pricing?: "free" | "paid";
  /** Upstream provider inside a multi-provider harness such as OpenCode. */
  provider?: {
    id: string;
    name: string;
  };
  settings?: ModelSetting[];
  /** Context window, when the harness catalog reports one. */
  contextWindow?: number;
};

export const MODELS: AgentModel[] = [
  { id: "codex:default", harness: "codex", name: "CLI default", nativeId: "" },
  {
    id: "minimax:default",
    harness: "minimax",
    name: "CLI default",
    nativeId: "",
  },
  { id: "mimo:default", harness: "mimo", name: "CLI default", nativeId: "" },
  {
    id: "claude:sonnet-5",
    harness: "claude",
    name: "Claude Sonnet 5",
    nativeId: "claude-sonnet-5",
  },
  {
    id: "claude:opus-5",
    harness: "claude",
    name: "Claude Opus 5",
    nativeId: "claude-opus-5",
  },
  {
    id: "claude:opus-5-5",
    harness: "claude",
    name: "Claude Opus 5.5",
    nativeId: "claude-opus-5-5",
  },
  {
    id: "claude:fable-5",
    harness: "claude",
    name: "Claude Fable 5",
    nativeId: "claude-fable-5",
  },
  {
    id: "claude:opus-4.6",
    harness: "claude",
    name: "Opus 4.6",
    nativeId: "claude-opus-4-6",
  },
  {
    id: "claude:sonnet-4.6",
    harness: "claude",
    name: "Sonnet 4.6",
    nativeId: "claude-sonnet-4-6",
  },
  {
    id: "claude:haiku-4.5",
    harness: "claude",
    name: "Haiku 4.5",
    nativeId: "claude-haiku-4-5",
  },
  {
    id: "claude:opus-4.5",
    harness: "claude",
    name: "Opus 4.5",
    nativeId: "claude-opus-4-5",
  },

  {
    id: "cursor:composer-2.5",
    harness: "cursor",
    name: "Composer 2.5",
    nativeId: "composer-2.5",
  },
  {
    id: "cursor:gpt-5.4",
    harness: "cursor",
    name: "GPT-5.4",
    nativeId: "gpt-5.4",
  },
  {
    id: "cursor:claude-sonnet-4-6",
    harness: "cursor",
    name: "Sonnet 4.6",
    nativeId: "claude-sonnet-4-6",
  },
  {
    id: "cursor:grok-4.6",
    harness: "cursor",
    name: "Cursor Grok 4.6",
    nativeId: "grok-4.6",
  },

  {
    id: "grok:grok-4.6",
    harness: "grok",
    name: "Grok 4.6",
    nativeId: "grok-4.6",
    contextWindow: 500_000,
    settings: [
      {
        id: "effort",
        label: "Reasoning",
        kind: "select",
        value: "high",
        options: [
          { value: "xhigh", label: "Extra High" },
          { value: "high", label: "High" },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ],
      },
    ],
  },
  {
    id: "grok:grok-4.5",
    harness: "grok",
    name: "Grok 4.5",
    nativeId: "grok-4.5",
    contextWindow: 500_000,
    settings: [
      {
        id: "effort",
        label: "Reasoning",
        kind: "select",
        value: "high",
        options: [
          { value: "high", label: "High" },
          { value: "medium", label: "Medium" },
          { value: "low", label: "Low" },
        ],
      },
    ],
  },

  { id: "opencode:glm-5", harness: "opencode", name: "GLM 5" },
  { id: "opencode:minimax-m2.5", harness: "opencode", name: "MiniMax M2.5" },
  { id: "opencode:kimi-k2.5", harness: "opencode", name: "Kimi K2.5" },
  {
    id: "opencode:deepseek-v4-flash",
    harness: "opencode",
    name: "DeepSeek V4 Flash",
  },
  { id: "opencode:qwen-3.5", harness: "opencode", name: "Qwen 3.5" },
  { id: "opencode:grok-4.5", harness: "opencode", name: "Grok 4.5" },
  {
    id: "opencode:claude-sonnet-4.6",
    harness: "opencode",
    name: "Claude Sonnet 4.6",
  },
  { id: "opencode:gpt-5.4", harness: "opencode", name: "GPT-5.4" },
  {
    id: "pi:default",
    harness: "pi",
    name: "Default",
    nativeId: "",
  },
  {
    id: "hermes:default",
    harness: "hermes",
    name: "Configured model",
    nativeId: "",
  },
];

export const DEFAULT_MODEL_ID: Record<HarnessId, string> = {
  claude: "claude:sonnet-5",
  codex: "codex:default",
  minimax: "minimax:default",
  mimo: "mimo:default",
  zcode: "zcode:default",
  cursor: "cursor:composer-2.5",
  grok: "grok:grok-4.6",
  opencode: "opencode:glm-5",
  pi: "pi:default",
  omp: "omp:default",
  fx: "fx:zai/glm-5.2-fast",
  hermes: "hermes:default",
  antigravity: "antigravity:gemini-3.8-flash-high",
};

const FAVORITES_KEY = "monocode.favoriteModels";
const MODEL_PICKER_TAB_KEY = "monocode.modelPickerTab";
const HIDDEN_PICKER_PROVIDERS_KEY = "monocode.hiddenPickerProviders";
const LAST_MODEL_KEY = "monocode.lastModel";
const LAST_MODEL_SETTINGS_KEY = "monocode.lastModelSettings";
const DEFAULT_MODELS_KEY = "monocode.defaultModels";
const RECENT_MODELS_KEY = "monocode.recentModels";
const RECENT_MODEL_LIMIT = 6;

export type ModelPickerTab = "favorites" | HarnessId;

export type LastModelChoice = {
  harness: HarnessId;
  model: string;
};

const HARNESS_ORDER: HarnessId[] = [
  "claude",
  "codex",
  "minimax",
  "cursor",
  "grok",
  "opencode",
  "pi",
  "hermes",
  "mimo",
];

const EMPTY_MODELS: AgentModel[] = [];

let overlays: Partial<Record<HarnessId, AgentModel[]>> = {};
let overlayDefaults: Partial<Record<HarnessId, string>> = {};
let catalogVersion = 0;
const listeners = new Set<() => void>();

function emit() {
  mergedModels = {};
  catalogVersion += 1;
  baseByHarness = null;
  indexById = null;
  allCache = null;
  for (const listener of listeners) listener();
}

export function subscribeModels(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getModelSnapshot(): number {
  return catalogVersion;
}

export function setHarnessModels(harness: HarnessId, models: AgentModel[]) {
  if (models.length === 0) return;
  overlays = { ...overlays, [harness]: models };
  overlayDefaults = {
    ...overlayDefaults,
    [harness]: pickDefaultId(harness, models),
  };
  emit();
}

/** True after a live CLI catalog has replaced the built-in fallback list. */
export function hasLiveCatalog(harness: HarnessId): boolean {
  return overlays[harness] != null;
}

/** A successful empty discovery must not keep deleted custom connections. */
export function clearHarnessModels(harness: HarnessId): void {
  if (overlays[harness] == null) return;
  const next = { ...overlays };
  const defaults = { ...overlayDefaults };
  delete next[harness];
  delete defaults[harness];
  overlays = next;
  overlayDefaults = defaults;
  emit();
}

/** Test seam. */
export function resetHarnessModelOverlays() {
  overlays = {};
  overlayDefaults = {};
  emit();
}

export function defaultModelId(harness: HarnessId): string {
  return overlayDefaults[harness] ?? DEFAULT_MODEL_ID[harness];
}

// `modelsFor`/`findModel` sit in render bodies (every session card, every
// provider row, the picker itself), so they must not rebuild the catalog on
// each call. These caches are dropped in `emit()` whenever an overlay lands.
let baseByHarness: Partial<Record<HarnessId, AgentModel[]>> | null = null;
let allCache: AgentModel[] | null = null;
let indexById: Map<string, AgentModel> | null = null;

function baseModelsFor(harness: HarnessId): AgentModel[] {
  if (!baseByHarness) {
    const grouped: Partial<Record<HarnessId, AgentModel[]>> = {};
    for (const model of MODELS) {
      (grouped[model.harness] ??= []).push(model);
    }
    baseByHarness = grouped;
  }
  return baseByHarness[harness] ?? EMPTY_MODELS;
}

let connections: ModelConnection[] = [];
let mergedModels: Partial<Record<HarnessId, AgentModel[]>> = {};
export function supportsConnection(harness: HarnessId, api: string): boolean {
  if (["pi", "opencode", "mimo"].includes(harness)) return true;
  if (harness === "hermes") return api === "openai-completions";
  if (harness === "minimax")
    return api === "openai-completions" || api === "anthropic-messages";
  return (
    (harness === "claude" && api === "anthropic-messages") ||
    (harness === "codex" && api === "openai-responses")
  );
}
let connectionRevision = 0;
export function getConnectionRevision() {
  return connectionRevision;
}
export function connectionReady(c: ModelConnection): boolean {
  if (c.hasKey) return true;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(c.baseUrl).hostname,
    );
  } catch {
    return false;
  }
}
export function connectionSupportsHarness(
  harness: HarnessId,
  c: ModelConnection,
): boolean {
  return (
    supportsConnection(harness, c.api) ||
    (harness === "claude" &&
      /^https:\/\/(api|token-plan-cn)\.xiaomimimo\.com\/(v1|anthropic)\/?$/.test(
        c.baseUrl,
      ))
  );
}
export function setConnectionModels(next: ModelConnection[]) {
  connectionRevision++;
  connections = next;
  emit();
}
export function modelPriceRank(model: AgentModel): number {
  if (model.connectionId) return 0;
  if (
    model.pricing === "free" ||
    /(?:^|[:/ -])free(?:$|[ -])/i.test(model.nativeId || model.id)
  )
    return 1;
  return 2;
}
export function sortModels(models: AgentModel[]): AgentModel[] {
  return [...models].sort((a, b) => modelPriceRank(a) - modelPriceRank(b));
}
export function modelsFor(harness: HarnessId): AgentModel[] {
  if (mergedModels[harness]) return mergedModels[harness]!;
  const external: AgentModel[] = connections
    .filter(
      (c) =>
        c.enabled &&
        connectionReady(c) &&
        connectionSupportsHarness(harness, c),
    )
    .flatMap((c) =>
      c.models.map((model) => ({
        id: `${harness}:mycode-${c.id}/${model}`,
        harness,
        name: c.modelMetadata?.[model]?.name || model,
        contextWindow: c.modelMetadata?.[model]?.contextWindow || undefined,
        settings: [
          ...(c.modelMetadata?.[model]?.reasoningEfforts?.length
            ? [
                {
                  id:
                    harness === "pi"
                      ? "thinking"
                      : ["opencode", "mimo"].includes(harness)
                        ? "variant"
                        : harness === "codex"
                          ? "reasoningEffort"
                          : "effort",
                  label: "Reasoning",
                  kind: "select" as const,
                  value: c.modelMetadata[model].reasoningEfforts![0],
                  options: c.modelMetadata[model].reasoningEfforts!.map(
                    (value) => ({ value, label: value }),
                  ),
                },
              ]
            : []),
          ...(c.modelMetadata?.[model]?.thinking
            ? [
                {
                  id: ["opencode", "mimo"].includes(harness)
                    ? "variant"
                    : "thinking",
                  label: "Thinking",
                  kind: "select" as const,
                  value:
                    harness === "pi"
                      ? "high"
                      : ["opencode", "mimo"].includes(harness)
                        ? "thinking"
                        : "true",
                  options: [
                    {
                      value:
                        harness === "pi"
                          ? "high"
                          : ["opencode", "mimo"].includes(harness)
                            ? "thinking"
                            : "true",
                      label: "On",
                    },
                    {
                      value:
                        harness === "pi"
                          ? "off"
                          : ["opencode", "mimo"].includes(harness)
                            ? "normal"
                            : "false",
                      label: "Off",
                    },
                  ],
                },
              ]
            : []),
          ...(c.modelMetadata?.[model]?.contextWindow
            ? [
                {
                  id: "contextWindow",
                  label: "Context usage",
                  kind: "select" as const,
                  value: String(c.modelMetadata[model].contextWindow),
                  options: [
                    ...new Set(
                      [
                        32768,
                        65536,
                        131072,
                        262144,
                        c.modelMetadata[model].contextWindow!,
                      ].filter(
                        (n) => n <= c.modelMetadata![model].contextWindow!,
                      ),
                    ),
                  ]
                    .sort((a, b) => a - b)
                    .map((n) => ({
                      value: String(n),
                      label:
                        n >= 1_000_000
                          ? `${+(n / (n % 1024 === 0 ? 1_048_576 : 1_000_000)).toFixed(2)}M`
                          : `${+(n / 1024).toFixed(1)}K`,
                    })),
                },
              ]
            : []),
        ],
        connectionId: c.id,
        primary: c.primaryModel === model,
        nativeId:
          harness === "minimax"
            ? `custom_provider:mycode-${c.id}/${model}`
            : ["pi", "opencode", "mimo"].includes(harness)
              ? `mycode-${c.id}/${model}`
              : model,
        provider: { id: `mycode-${c.id}`, name: c.name },
      })),
    );
  const ids = new Set(external.map((m) => m.id));
  return (mergedModels[harness] = sortModels([
    ...external,
    ...(overlays[harness] ?? baseModelsFor(harness)).filter(
      (m) => !ids.has(m.id),
    ),
  ]));
}

export function allModels(): AgentModel[] {
  return (allCache ??= HARNESS_ORDER.flatMap(modelsFor));
}

export function findModel(id: string): AgentModel | undefined {
  if (!indexById) {
    const index = new Map<string, AgentModel>();
    // First writer wins, matching the previous `allModels().find(...)` order.
    for (const model of allModels()) {
      if (!index.has(model.id)) index.set(model.id, model);
    }
    indexById = index;
  }
  return indexById.get(id);
}

export function resolveModel(harness: HarnessId, id?: string): AgentModel {
  const cliDefault = MODELS.find(
    (model) =>
      model.id === id && model.harness === harness && model.nativeId === "",
  );
  if (cliDefault) return cliDefault;
  const available = modelsFor(harness);
  if (id) {
    const exact = findModel(id);
    if (exact && exact.harness === harness) return exact;
    // Saved custom choices must never silently become a paid official model
    // while connections are loading, disabled, or missing credentials.
    if (id.startsWith(`${harness}:mycode-`)) {
      return {
        id,
        harness,
        name: id.slice(id.indexOf("/") + 1),
        nativeId: nativeIdFrom(id),
      };
    }
    const slug = nativeIdFrom(id);
    const byNative = available.find(
      (model) => (model.nativeId ?? nativeIdFrom(model.id)) === slug,
    );
    if (byNative) return byNative;
    const comparableSlug = comparableNativeId(harness, slug);
    const prefix = available.find((model) => {
      const native = model.nativeId ?? nativeIdFrom(model.id);
      const comparableNative = comparableNativeId(harness, native);
      return (
        Boolean(comparableNative) &&
        (comparableNative.startsWith(comparableSlug) ||
          comparableSlug.startsWith(comparableNative))
      );
    });
    if (prefix) return prefix;
  }
  // Codex has no built-in catalog. During startup, retain the saved model
  // until discovery finishes instead of borrowing another provider's model.
  if (
    available.length === 0 ||
    (id &&
      harness === "codex" &&
      available.every((model) => model.id === "codex:default"))
  ) {
    const requested = id?.trim() ?? "";
    const modelId =
      requested &&
      (!requested.includes(":") || requested.startsWith(`${harness}:`))
        ? requested
        : "";
    const nativeId = nativeIdFrom(modelId);
    return {
      id: modelId,
      harness,
      name: nativeId
        ? nativeId
            .replace(/^gpt/i, "GPT")
            .replace(
              /-([a-z])/g,
              (_, letter: string) => `-${letter.toUpperCase()}`,
            )
        : harness.charAt(0).toUpperCase() + harness.slice(1),
      nativeId,
    };
  }
  const fallbackId = defaultModelId(harness);
  return (fallbackId ? findModel(fallbackId) : undefined) ?? available[0];
}

/** Catalog-reported context window for a model id, when known. */
export function modelContextWindow(id: string): number | undefined {
  const window = findModel(id)?.contextWindow;
  return window && window > 0 ? window : undefined;
}

export function nativeModelId(model: AgentModel | string): string {
  // Persisted CLI-default choices survive replacement of the initial catalog.
  // They mean “let the CLI choose”, never a literal model named `default`.
  const id = typeof model === "string" ? model : model.id;
  if (
    [
      "codex:default",
      "minimax:default",
      "mimo:default",
      "zcode:default",
    ].includes(id)
  )
    return "";
  if (typeof model !== "string") {
    return model.nativeId ?? nativeIdFrom(model.id);
  }
  return findModel(model)?.nativeId ?? nativeIdFrom(model);
}

export function defaultModelSettings(
  model: AgentModel,
): Record<string, string> {
  const settings: Record<string, string> = {};
  for (const setting of model.settings ?? []) {
    settings[setting.id] = setting.value;
  }
  return settings;
}

export function mergeModelSettings(
  model: AgentModel,
  current?: Record<string, string>,
): Record<string, string> {
  if (
    modelsFor(model.harness).length === 0 ||
    (model.harness === "codex" && !hasLiveCatalog("codex"))
  )
    return { ...current };
  const next = defaultModelSettings(model);
  if (!current) return next;
  for (const setting of model.settings ?? []) {
    const value = compatibleSettingValue(setting, current[setting.id]);
    if (value != null) next[setting.id] = value;
  }
  return next;
}

const EFFORT_SETTING_IDS = new Set([
  "effort",
  "reasoning",
  "reasoningEffort",
  // Pi and OMP expose their reasoning level as a `thinking` select.
  "thinking",
  // OpenCode exposes reasoning levels as `variant`; treat it as effort so the
  // standalone effort control and dedup behave like Codex/Cursor/Grok.
  "variant",
]);

/** True for the select setting ids that control reasoning effort. */
export function isEffortSettingId(id: string): boolean {
  return EFFORT_SETTING_IDS.has(id);
}

/** The select setting that controls reasoning effort for this model, if any. */
export function modelEffortSetting(
  model: AgentModel,
): ModelSetting | undefined {
  return model.settings?.find(
    (setting) =>
      setting.kind === "select" && EFFORT_SETTING_IDS.has(setting.id),
  );
}

export function modelEffortLabel(
  model: AgentModel,
  values?: Record<string, string>,
): string | undefined {
  const setting = modelEffortSetting(model);
  if (!setting) return undefined;
  const value = values?.[setting.id] ?? setting.value;
  return (
    setting.options.find((option) => option.value === value)?.label ?? value
  );
}

/** Last chosen effort/fast/etc., applied to any model that supports those values. */
export function preferredModelSettings(
  model: AgentModel,
  current?: Record<string, string>,
): Record<string, string> {
  if (modelsFor(model.harness).length === 0) return { ...current };
  return mergeModelSettings(model, {
    ...current,
    ...loadLastModelSettings(),
  });
}

export function loadLastModelSettings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LAST_MODEL_SETTINGS_KEY);
    if (!raw) return {};
    return parseStringRecord(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function saveLastModelSettings(
  settings: Record<string, string>,
  mode: "overwrite" | "fill" = "overwrite",
) {
  const prev = loadLastModelSettings();
  const incoming = parseStringRecord(settings);
  const next =
    mode === "fill" ? { ...incoming, ...prev } : { ...prev, ...incoming };
  try {
    localStorage.setItem(LAST_MODEL_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota
  }
}

/** Compound launch id, e.g. `claude-opus-4-8[effort=high,fast=false]`. */
export function encodeModelLaunchId(
  modelId: string,
  settings?: Record<string, string>,
): string {
  const model = findModel(modelId);
  const native = nativeModelId(model ?? modelId);
  const defs = model?.settings ?? [];
  if (!native || defs.length === 0) return native;
  const parts = defs.map(
    (setting) => `${setting.id}=${settings?.[setting.id] ?? setting.value}`,
  );
  return `${native}[${parts.join(",")}]`;
}

export function loadFavoriteModels(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function saveFavoriteModels(ids: string[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
  } catch {
    // private mode / quota
  }
}

function isHarnessId(value: string): value is HarnessId {
  return HARNESS_ORDER.includes(value as HarnessId);
}

export function loadModelPickerTab(): ModelPickerTab {
  try {
    const raw = localStorage.getItem(MODEL_PICKER_TAB_KEY);
    if (!raw) return "favorites";
    if (raw === "favorites") return "favorites";
    if (isHarnessId(raw)) return raw;
    return "favorites";
  } catch {
    return "favorites";
  }
}

export function saveModelPickerTab(tab: ModelPickerTab) {
  try {
    localStorage.setItem(MODEL_PICKER_TAB_KEY, tab);
  } catch {
    // private mode / quota
  }
}

let pickerVisibilityVersion = 0;
const pickerVisibilityListeners = new Set<() => void>();

function emitPickerVisibility() {
  pickerVisibilityVersion += 1;
  for (const listener of pickerVisibilityListeners) listener();
}

export function subscribePickerVisibility(
  onStoreChange: () => void,
): () => void {
  pickerVisibilityListeners.add(onStoreChange);
  return () => {
    pickerVisibilityListeners.delete(onStoreChange);
  };
}

export function getPickerVisibilitySnapshot(): number {
  return pickerVisibilityVersion;
}

export function loadHiddenPickerProviders(): HarnessId[] {
  try {
    const raw = localStorage.getItem(HIDDEN_PICKER_PROVIDERS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is HarnessId => typeof id === "string" && isHarnessId(id),
    );
  } catch {
    return [];
  }
}

export function isPickerProviderVisible(id: HarnessId): boolean {
  return !loadHiddenPickerProviders().includes(id);
}

export function savePickerProviderVisible(id: HarnessId, visible: boolean) {
  const hidden = new Set(loadHiddenPickerProviders());
  if (visible) hidden.delete(id);
  else hidden.add(id);
  try {
    localStorage.setItem(
      HIDDEN_PICKER_PROVIDERS_KEY,
      JSON.stringify([...hidden]),
    );
  } catch {
    // private mode / quota
  }
  emitPickerVisibility();
}

/**
 * Installed providers the user has not hidden appear as picker tabs.
 * Before the first probe we keep them visible so the tab strip does not
 * collapse to Favorites and then jump once CLIs are found.
 */
export function showProviderInModelPicker(
  id: HarnessId,
  installed: boolean,
  probed: boolean,
): boolean {
  if (!isPickerProviderVisible(id)) return false;
  return (
    id === "codex" || id === "mimo" || id === "zcode" || !probed || installed
  );
}

export function modelPickerTabs(
  available: (id: HarnessId) => boolean,
): ModelPickerTab[] {
  return ["favorites", ...HARNESSES.filter(available)];
}

export function coerceModelPickerTab(
  tab: ModelPickerTab,
  available: (id: HarnessId) => boolean,
): ModelPickerTab {
  const tabs = modelPickerTabs(available);
  return tabs.includes(tab) ? tab : "favorites";
}

export function stepModelPickerTab(
  tab: ModelPickerTab,
  delta: -1 | 1,
  available: (id: HarnessId) => boolean,
): ModelPickerTab {
  const tabs = modelPickerTabs(available);
  if (tabs.length === 0) return tab;
  const index = tabs.indexOf(tab);
  const from = index < 0 ? 0 : index;
  return tabs[(from + delta + tabs.length) % tabs.length] ?? tab;
}

export function loadDefaultModels(): Partial<Record<HarnessId, string>> {
  try {
    const raw = localStorage.getItem(DEFAULT_MODELS_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Partial<Record<HarnessId, string>> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isHarnessId(key) && typeof value === "string" && value) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDefaultModel(harness: HarnessId, model: string) {
  const next = { ...loadDefaultModels(), [harness]: model };
  try {
    localStorage.setItem(DEFAULT_MODELS_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota
  }
}

/** User-picked model for a provider, else the catalog default. */
export function preferredModelId(harness: HarnessId): string {
  const primary = modelsFor(harness).find((model) => model.primary);
  if (primary) return primary.id;
  const saved = loadDefaultModels()[harness];
  if (saved) return saved;
  const last = loadLastModelChoice();
  if (last?.harness === harness) return last.model;
  return defaultModelId(harness);
}

/**
 * `preferred` unless the project hides it, in which case the first provider the
 * project still allows. Falls back to `preferred` when a project has hidden
 * everything, so a conversation always has a provider.
 */
export function firstEnabledHarness(
  cwd: string | undefined,
  preferred: HarnessId,
): HarnessId {
  const hidden = new Set(loadProjectProviderSettings(cwd).hidden ?? []);
  const enabled = (id: HarnessId) =>
    !hidden.has(id) &&
    showProviderInModelPicker(
      id,
      isHarnessAvailable(id),
      hasProbedHarnessAvailability(),
    );
  if (enabled(preferred)) return preferred;
  return HARNESSES.find(enabled) ?? preferred;
}

/** Provider + model new conversations should start with. */
export function defaultSessionChoice(cwd?: string): LastModelChoice {
  const project = loadProjectProviderSettings(cwd);
  const last = loadLastModelChoice();
  let harness = firstEnabledHarness(
    cwd,
    project.defaultHarness ?? last?.harness ?? "cursor",
  );
  // A configured primary connection wins for new tasks. If the last CLI
  // cannot use that protocol, choose an available compatible CLI instead.
  const primary =
    modelsFor(harness).find((model) => model.primary) ??
    HARNESSES.flatMap(modelsFor).find(
      (model) =>
        model.primary &&
        firstEnabledHarness(cwd, model.harness) === model.harness,
    );
  if (primary) {
    harness = primary.harness;
    return { harness, model: primary.id };
  }
  const model =
    project.models?.[harness] ??
    (project.defaultHarness === harness ? project.defaultModel : undefined) ??
    preferredModelId(harness);
  return { harness, model };
}

export function loadLastModelChoice(): LastModelChoice | null {
  try {
    const raw = localStorage.getItem(LAST_MODEL_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed != null &&
      "harness" in parsed &&
      "model" in parsed &&
      typeof (parsed as LastModelChoice).harness === "string" &&
      typeof (parsed as LastModelChoice).model === "string" &&
      isHarnessId((parsed as LastModelChoice).harness)
    ) {
      return parsed as LastModelChoice;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLastModelChoice(harness: HarnessId, model: string) {
  saveDefaultModel(harness, model);
  try {
    localStorage.setItem(LAST_MODEL_KEY, JSON.stringify({ harness, model }));
  } catch {
    // private mode / quota
  }
}

export function loadRecentModelChoices(): LastModelChoice[] {
  try {
    const raw = localStorage.getItem(RECENT_MODELS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const choices: LastModelChoice[] = [];
    for (const item of parsed) {
      if (
        typeof item !== "object" ||
        item == null ||
        !("harness" in item) ||
        !("model" in item) ||
        typeof (item as LastModelChoice).harness !== "string" ||
        typeof (item as LastModelChoice).model !== "string" ||
        !isHarnessId((item as LastModelChoice).harness)
      ) {
        continue;
      }
      const choice = item as LastModelChoice;
      const key = `${choice.harness}\0${choice.model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      choices.push(choice);
      if (choices.length === RECENT_MODEL_LIMIT) break;
    }
    return choices;
  } catch {
    return [];
  }
}

export function saveRecentModelChoice(
  harness: HarnessId,
  model: string,
): LastModelChoice[] {
  const next = [
    { harness, model },
    ...loadRecentModelChoices().filter(
      (choice) => choice.harness !== harness || choice.model !== model,
    ),
  ].slice(0, RECENT_MODEL_LIMIT);
  try {
    localStorage.setItem(RECENT_MODELS_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota
  }
  return next;
}

function parseStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") out[key] = entry;
  }
  return out;
}

/** Cursor CLI uses `extra-high`; Claude uses `xhigh`. */
const SETTING_VALUE_ALIASES: Record<string, string> = {
  "extra-high": "xhigh",
  xhigh: "extra-high",
};

function compatibleSettingValue(
  setting: ModelSetting,
  value: string | undefined,
): string | undefined {
  if (value == null) return undefined;
  if (setting.options.some((option) => option.value === value)) return value;
  const alias = SETTING_VALUE_ALIASES[value];
  if (alias && setting.options.some((option) => option.value === alias)) {
    return alias;
  }
  return undefined;
}

function nativeIdFrom(id: string): string {
  const trimmed = id.trim();
  const colon = trimmed.indexOf(":");
  const slug = colon >= 0 ? trimmed.slice(colon + 1) : trimmed;
  const bracket = slug.indexOf("[");
  return bracket >= 0 ? slug.slice(0, bracket) : slug;
}

/** Claude's live catalog uses `opus`; its startup fallback uses `claude-opus-5`. */
function comparableNativeId(harness: HarnessId, id: string): string {
  return harness === "claude" ? id.replace(/^claude-/, "") : id;
}

function pickDefaultId(harness: HarnessId, models: AgentModel[]): string {
  if (harness === "claude") {
    return (
      models.find((model) => model.nativeId === "claude-sonnet-5")?.id ??
      models.find((model) => model.nativeId === "sonnet")?.id ??
      models.find((model) => model.id === DEFAULT_MODEL_ID.claude)?.id ??
      models[0]?.id ??
      DEFAULT_MODEL_ID.claude
    );
  }
  if (harness === "cursor") {
    return (
      models.find((model) => model.nativeId === "composer-2.5")?.id ??
      models.find(
        (model) => model.nativeId === "default" || model.nativeId === "auto",
      )?.id ??
      models[0]?.id ??
      DEFAULT_MODEL_ID.cursor
    );
  }
  if (harness === "codex") {
    return models[0]?.id ?? "";
  }
  if (harness === "grok") {
    return (
      models.find((model) => model.nativeId === "grok-4.6")?.id ??
      models.find((model) => model.id === DEFAULT_MODEL_ID.grok)?.id ??
      models[0]?.id ??
      DEFAULT_MODEL_ID.grok
    );
  }
  if (harness === "fx") {
    const preferred = [
      "zai/glm-5.2-fast",
      "zai/glm-5.2",
      "zai/glm-4.7-flash",
      "zai/glm-4.7",
      "openai/gpt-5.2",
    ];
    for (const nativeId of preferred) {
      const hit = models.find((model) => model.nativeId === nativeId);
      if (hit) return hit.id;
    }
    return (
      models.find((model) => model.id === DEFAULT_MODEL_ID.fx)?.id ??
      models[0]?.id ??
      DEFAULT_MODEL_ID.fx
    );
  }
  return (
    models.find((model) => model.id === DEFAULT_MODEL_ID[harness])?.id ??
    models[0]?.id ??
    DEFAULT_MODEL_ID[harness]
  );
}
