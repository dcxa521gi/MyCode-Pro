import type { ModelConnection, ModelMetadata } from "./modelConnections";

export const MAGPIE_ENGINES = ["claude", "codex", "pi"] as const;
export function magpieRuntime(connection: ModelConnection, engine: string) {
  if (connection.gateway !== "magpie")
    return { api: connection.api, baseUrl: connection.baseUrl };
  const key =
    engine === "claude" ? "claude" : engine === "codex" ? "codex" : "pi";
  const root = connection.baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
  return {
    api:
      key === "claude"
        ? "anthropic-messages"
        : key === "codex"
          ? "openai-responses"
          : "openai-completions",
    baseUrl:
      connection.magpieEndpoints?.[key] ||
      root + (key === "claude" ? "" : "/v1"),
  };
}
export function magpieSupplier(metadata?: ModelMetadata): string | undefined {
  const source = metadata?.discoveredSource;
  if (
    source?.kind !== "magpie" ||
    !source.providerId ||
    /[\x00-\x1f\x7f]/.test(source.providerId)
  )
    return;
  const prefix = source.discoveredName ? `${source.discoveredName} · ` : "";
  const label =
    prefix && source.label?.startsWith(prefix)
      ? source.label.slice(prefix.length).trim()
      : "";
  return label && label !== source.providerId
    ? `${label} · ${source.providerId}`
    : source.providerId;
}

/** Magpie translates chat wire formats; a manufacturer's native API is not a gateway restriction. */
export function magpieMetadata(
  connection: ModelConnection,
  metadata?: ModelMetadata,
): ModelMetadata | undefined {
  if (
    connection.gateway !== "magpie" ||
    ![
      "anthropic-messages",
      "openai-responses",
      "openai-completions",
      "anthropic:messages",
      "openai:responses",
      "openai:chat-completions",
      "google-generative-ai",
    ].includes(metadata?.nativeApi ?? "")
  )
    return metadata;
  return { ...metadata, nativeApi: null };
}
