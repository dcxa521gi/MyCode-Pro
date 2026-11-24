import { getLocale, translate } from "../../../shared/i18n";

/** Local workflow tools inspired by Cindy's named tools and host-rendered forms.
 * No executable JS, HTML, credentials or cloud service is installed by a manifest. */
export type PluginText = { en: string; "zh-CN": string };
export type PluginField = {
  key: string;
  label: PluginText;
  type: "text" | "textarea" | "select" | "switch";
  required?: boolean;
  options?: { value: string; label: PluginText }[];
};
export type PluginTool = {
  id: string;
  name: PluginText;
  description: PluginText;
  instructions: PluginText;
  fields: PluginField[];
};
export type LocalPlugin = {
  schemaVersion: 1;
  id: string;
  version: string;
  name: PluginText;
  description: PluginText;
  tools: PluginTool[];
  enabled: boolean;
};
const KEY = "mycode.localWorkflowPlugins.v1";
const CHANGE = "mycode:local-plugins";
export const pluginText = (value: PluginText) =>
  value[getLocale() === "zh-CN" ? "zh-CN" : "en"];
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(translate("Invalid local plugin manifest"));
  return value as Record<string, unknown>;
};
const name = (value: unknown) => {
  if (typeof value !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(value))
    throw Error(
      translate(
        "Plugin and tool IDs must use lowercase letters, digits, underscores or hyphens",
      ),
    );
  return value;
};
function bilingual(value: unknown, limit = 500): PluginText {
  const text = record(value);
  if (
    ["en", "zh-CN"].some(
      (locale) =>
        typeof text[locale] !== "string" ||
        !(text[locale] as string).trim() ||
        (text[locale] as string).length > limit,
    )
  )
    throw Error(
      translate(
        "Plugin labels and instructions require English and Simplified Chinese",
      ),
    );
  return { en: text.en as string, "zh-CN": text["zh-CN"] as string };
}
function onlyKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw Error(
      translate(
        "The plugin contains unsupported fields. Executable scripts and remote pages are not supported by workflow plugins.",
      ),
    );
}
export function parseLocalPlugin(raw: unknown): LocalPlugin {
  if (JSON.stringify(raw).length > 256_000)
    throw Error(translate("Local plugin manifest is too large"));
  const input = record(raw);
  onlyKeys(input, [
    "schemaVersion",
    "id",
    "version",
    "name",
    "description",
    "tools",
    "enabled",
  ]);
  if (
    input.schemaVersion !== 1 ||
    typeof input.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(input.version) ||
    !Array.isArray(input.tools) ||
    !input.tools.length ||
    input.tools.length > 20
  )
    throw Error(translate("Invalid local plugin manifest"));
  const tools = input.tools.map((value) => {
    const tool = record(value);
    onlyKeys(tool, ["id", "name", "description", "instructions", "fields"]);
    if (!Array.isArray(tool.fields) || tool.fields.length > 12)
      throw Error(translate("A plugin form supports up to 12 fields"));
    const fields = tool.fields.map((value) => {
      const field = record(value);
      onlyKeys(field, ["key", "label", "type", "required", "options"]);
      if (
        !["text", "textarea", "select", "switch"].includes(String(field.type))
      )
        throw Error(translate("Unsupported plugin form field"));
      let options: PluginField["options"];
      if (field.type === "select") {
        if (
          !Array.isArray(field.options) ||
          !field.options.length ||
          field.options.length > 50
        )
          throw Error(translate("Invalid plugin form options"));
        options = field.options.map((value) => {
          const option = record(value);
          if (
            typeof option.value !== "string" ||
            !option.value ||
            option.value.length > 512
          )
            throw Error(translate("Invalid plugin form options"));
          return { value: option.value, label: bilingual(option.label, 100) };
        });
        if (new Set(options.map((o) => o.value)).size !== options.length)
          throw Error(translate("Invalid plugin form options"));
      }
      return {
        key: name(field.key),
        label: bilingual(field.label, 100),
        type: field.type as PluginField["type"],
        required: field.required === true,
        ...(options ? { options } : {}),
      };
    });
    if (new Set(fields.map((f) => f.key)).size !== fields.length)
      throw Error(translate("Duplicate plugin form fields"));
    return {
      id: name(tool.id),
      name: bilingual(tool.name, 100),
      description: bilingual(tool.description),
      instructions: bilingual(tool.instructions, 12_000),
      fields,
    };
  });
  if (new Set(tools.map((t) => t.id)).size !== tools.length)
    throw Error(translate("Duplicate plugin tool IDs"));
  return {
    schemaVersion: 1,
    id: name(input.id),
    version: input.version,
    name: bilingual(input.name, 100),
    description: bilingual(input.description),
    tools,
    enabled: input.enabled !== false,
  };
}
export function localPlugins(): LocalPlugin[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(values)
      ? values.flatMap((v) => {
          try {
            return [parseLocalPlugin(v)];
          } catch {
            return [];
          }
        })
      : [];
  } catch {
    return [];
  }
}
export function saveLocalPlugins(plugins: LocalPlugin[]) {
  if (plugins.length > 64)
    throw Error(translate("At most 64 local plugins can be installed"));
  const validated = plugins.map(parseLocalPlugin);
  if (new Set(validated.map((p) => p.id)).size !== validated.length)
    throw Error(translate("Duplicate plugin IDs"));
  localStorage.setItem(KEY, JSON.stringify(validated));
  window.dispatchEvent(new Event(CHANGE));
}
export function subscribeLocalPlugins(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  return () => window.removeEventListener(CHANGE, onChange);
}
export type FormValues = Record<string, string | boolean>;
export function pluginFormValues(
  tool: PluginTool,
  input: unknown,
  requireAll = true,
): FormValues {
  const values = record(input);
  const result: FormValues = {};
  if (
    Object.keys(values).some((key) => !tool.fields.some((f) => f.key === key))
  )
    throw Error(translate("Unknown plugin form field"));
  for (const field of tool.fields) {
    const value = values[field.key];
    if (field.type === "switch") {
      if (value !== undefined && typeof value !== "boolean")
        throw Error(translate("Invalid plugin form value"));
      result[field.key] = value === true;
      continue;
    }
    if (
      value !== undefined &&
      (typeof value !== "string" || value.length > 8_000)
    )
      throw Error(translate("Invalid plugin form value"));
    const text = typeof value === "string" ? value : "";
    if (
      (requireAll && field.required && !text.trim()) ||
      (text &&
        field.type === "select" &&
        !field.options?.some((o) => o.value === text))
    )
      throw Error(
        `${translate("Check this form field")}: ${pluginText(field.label)}`,
      );
    result[field.key] = text;
  }
  return result;
}
export function pluginToolCatalog() {
  return localPlugins()
    .filter((p) => p.enabled)
    .flatMap((p) =>
      p.tools.map((tool) => ({
        pluginId: p.id,
        toolId: tool.id,
        name: pluginText(tool.name),
        description: pluginText(tool.description),
        fields: tool.fields,
        requiresUserForm: true,
      })),
    );
}
