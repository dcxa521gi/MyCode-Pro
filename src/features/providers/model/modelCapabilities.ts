import type { ModelMetadata } from "./modelConnections";
export const MODEL_CAPABILITIES = [
  "text",
  "vision",
  "image-generation",
  "video-understanding",
  "video-generation",
  "speech-recognition",
  "speech-generation",
  "music",
  "embedding",
  "reranking",
] as const;
export type ModelCapability = (typeof MODEL_CAPABILITIES)[number];
export const CAPABILITY_LABELS: Record<ModelCapability, string> = {
  text: "Text",
  vision: "Vision",
  "image-generation": "Image generation",
  "video-understanding": "Video understanding",
  "video-generation": "Video generation",
  "speech-recognition": "Speech recognition",
  "speech-generation": "Speech generation",
  music: "Music",
  embedding: "Embedding",
  reranking: "Reranking",
};
export type CapabilityTag = {
  capability: ModelCapability;
  evidence: "reported" | "manual" | "inferred";
};
/** Classification is descriptive; inferred tags never grant API support or enable a paid request by themselves. */
export function modelCapabilities(
  id: string,
  metadata?: ModelMetadata,
): CapabilityTag[] {
  const manual = metadata?.capabilityOverrides;
  if (Array.isArray(manual))
    return [...new Set(manual)]
      .filter((v) => MODEL_CAPABILITIES.includes(v))
      .map((capability) => ({ capability, evidence: "manual" }));
  const tags = new Map<ModelCapability, CapabilityTag["evidence"]>();
  const add = (
    tag: ModelCapability,
    evidence: CapabilityTag["evidence"] = "reported",
  ) => tags.set(tag, evidence);
  const input =
    metadata?.modalities ??
    metadata?.model_info?.inputModalities ??
    metadata?.model_info?.input_modalities;
  const output =
    metadata?.outputModalities ??
    metadata?.output_modalities ??
    metadata?.model_info?.outputModalities ??
    metadata?.model_info?.output_modalities;
  for (const modality of (input ?? []).map((m) => m.toLowerCase())) {
    if (modality === "image") add("vision");
    if (modality === "video") add("video-understanding");
    if (modality === "audio") add("speech-recognition");
  }
  for (const modality of (output ?? []).map((m) => m.toLowerCase())) {
    if (modality === "text") add("text");
    if (modality === "image") add("image-generation");
    if (modality === "video") add("video-generation");
    if (modality === "audio") add("speech-generation");
    if (modality === "music") add("music");
    if (["embedding", "embeddings"].includes(modality)) add("embedding");
    if (["rerank", "reranking"].includes(modality)) add("reranking");
  }
  const mode =
    `${metadata?.mode ?? ""} ${metadata?.nativeApi ?? ""}`.toLowerCase();
  if (/\b(image|images|image_generation|image-generation|openai-images|openai-image-generation)\b/.test(mode) && !/understanding|vision/.test(mode)) add("image-generation");
  if (/\b(video|videos|video_generation|video-generation|openai-videos)\b/.test(mode) && !/understanding/.test(mode)) add("video-generation");
  if (/audio_speech|audio-speech|\btts\b|elevenlabs/.test(mode))
    add("speech-generation");
  if (/transcription|\bstt\b/.test(mode)) add("speech-recognition");
  if (/vision|image[-_]understanding/.test(mode)) add("vision");
  if (/video[-_]understanding/.test(mode)) add("video-understanding");
  if (/music/.test(mode)) add("music");
  if (/embedding/.test(mode)) add("embedding");
  if (/rerank/.test(mode)) add("reranking");
  if (/chat|completion|responses|messages|generateContent/i.test(mode))
    add("text");
  // Explicit output evidence prevents names from inventing contradictory generation capabilities.
  const name = `${id} ${metadata?.name ?? ""}`.toLowerCase();
  if (!output?.length && !mode.trim()) {
    if (
      /\b(gpt-image|dall-e|flux|stable-diffusion|imagen|seedream)\b/.test(name)
    )
      add("image-generation", "inferred");
    else if (/\b(sora|veo|kling|wan[-_. ]?2|hailuo|seedance)\b/.test(name))
      add("video-generation", "inferred");
    else if (/\b(suno|udio|musicgen)\b/.test(name)) add("music", "inferred");
    else if (/\bwhisper\b/.test(name)) add("speech-recognition", "inferred");
    else if (/\b(tts|speech)\b/.test(name))
      add("speech-generation", "inferred");
    else if (/\b(embedding|embed)\b/.test(name)) add("embedding", "inferred");
    else if (/\brerank(?:er|ing)?\b/.test(name)) add("reranking", "inferred");
    else if (
      /\b(gpt|claude|gemini|deepseek|qwen|glm|kimi|mimo|llama|grok)(?=\b|\d)/.test(
        name,
      )
    )
      add("text", "inferred");
  }
  if (!input?.length && /\b(vision|vl)\b/.test(name)) add("vision", "inferred");
  return MODEL_CAPABILITIES.flatMap((capability) =>
    tags.has(capability)
      ? [{ capability, evidence: tags.get(capability)! }]
      : [],
  );
}
