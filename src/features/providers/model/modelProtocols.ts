import type { ModelMetadata } from "./modelConnections";
const aliases: Record<string, string> = {
  "openai-chat": "openai-completions",
  "openai:chat-completions": "openai-completions",
  "openai:responses": "openai-responses",
  "anthropic:messages": "anthropic-messages",
  "google:generateContent": "google-generative-ai",
  "chat-completions": "openai-completions",
  responses: "openai-responses",
};
const chatProtocols = [
  "openai-completions",
  "openai-responses",
  "anthropic-messages",
  "google-generative-ai",
];
function clientProtocols(metadata?: ModelMetadata): string[] {
  return [metadata?.supportedProtocols, metadata?.protocols]
    .flatMap((values) =>
      Array.isArray(values)
        ? values
            .filter((p) => typeof p === "string")
            .map((p) => aliases[p] || p)
        : [],
    )
    .filter((p) => chatProtocols.includes(p));
}
export function reportedProtocols(metadata?: ModelMetadata) {
  const client = clientProtocols(metadata);
  return [
    ...new Set(
      client.length
        ? client
        : typeof metadata?.nativeApi === "string"
          ? [aliases[metadata.nativeApi] || metadata.nativeApi]
          : [],
    ),
  ];
}
export function supportsProtocol(
  metadata: ModelMetadata | undefined,
  protocol: string,
) {
  if (!isChatModelMetadata(metadata)) return false;
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

/** Explicit media capability is authoritative; names and prefixes never infer it. */
export function isChatModelMetadata(metadata?: ModelMetadata): boolean {
  const outputs =
    metadata?.outputModalities ??
    metadata?.output_modalities ??
    metadata?.model_info?.outputModalities ??
    metadata?.model_info?.output_modalities;
  // Unknown vendor values retain compatibility until the directory supplies evidence.
  if (
    Array.isArray(outputs) &&
    outputs.length > 0 &&
    outputs.every(
      (value) =>
        typeof value === "string" &&
        ["audio", "image", "video", "embedding", "embeddings"].includes(
          value.toLowerCase(),
        ),
    )
  )
    return false;
  return (
    ![
      "audio_speech",
      "audio_transcription",
      "speech",
      "tts",
      "stt",
      "image",
      "image_generation",
      "video",
      "video_generation",
      "embedding",
      "embeddings",
    ].includes(metadata?.mode ?? "") &&
    (clientProtocols(metadata).length > 0 ||
      ![
        "openai-audio-speech",
        "openai-audio-transcriptions",
        "openai-images",
        "openai-image-generation",
        "openai-videos",
        "elevenlabs-tts",
      ].includes(metadata?.nativeApi ?? ""))
  );
}
