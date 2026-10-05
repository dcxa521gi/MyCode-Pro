import type { ModelMetadata } from "./modelConnections";
const aliases: Record<string, string> = {
  "openai:chat-completions": "openai-completions",
  "openai:responses": "openai-responses",
  "anthropic:messages": "anthropic-messages",
  "google:generateContent": "google-generative-ai",
  "chat-completions": "openai-completions",
  responses: "openai-responses",
};
export function reportedProtocols(metadata?: ModelMetadata) {
  return [
    ...new Set(
      (Array.isArray(metadata?.supportedProtocols)
        ? metadata.supportedProtocols
        : []
      )
        .filter((p) => typeof p === "string")
        .map((p) => aliases[p] || p),
    ),
  ];
}
export function supportsProtocol(
  metadata: ModelMetadata | undefined,
  protocol: string,
) {
  const known = reportedProtocols(metadata).filter((p) =>
    [
      "openai-completions",
      "openai-responses",
      "anthropic-messages",
      "google-generative-ai",
    ].includes(p),
  );
  return !known.length || known.includes(protocol);
}
