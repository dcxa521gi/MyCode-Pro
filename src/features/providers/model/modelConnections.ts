import { setConnectionModels } from "../../sessions/model/models";
import { invoke } from "@tauri-apps/api/core";

export type ModelMetadata = {
  name?: string;
  thinking?: boolean;
  contextWindow?: number;
  maxOutput?: number;
  modalities?: string[];
  reasoningEfforts?: string[];
  supportedProtocols?: string[];
  source?: string;
};

export type ModelConnection = {
  id: string;
  name: string;
  baseUrl: string;
  api: string;
  models: string[];
  modelMetadata?: Record<string, ModelMetadata>;
  enabled: boolean;
  hasKey: boolean;
  primaryModel?: string;
};
export type LocalAIConfig = {
  connections: ModelConnection[];
  memory: string;
  projectMemories: Record<string, string>;
  mcpServers: Record<string, unknown> | null;
};
export const loadLocalAIConfig = async () => {
  const config = await invoke<LocalAIConfig>("local_ai_config");
  setConnectionModels(config.connections);
  return config;
};

/** Endpoint templates only; model IDs are supplied by the user's own account. */
export const CONNECTION_PRESETS = [
  {
    name: "TokenDance · Partner",
    baseUrl: "https://tokendance.space/gateway/v1",
    api: "openai-completions",
  },
  {
    name: "xiaomimimo API",
    baseUrl: "https://api.xiaomimimo.com/v1",
    api: "openai-completions",
  },
  {
    name: "xiaomimimo token plan",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    api: "openai-completions",
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    api: "openai-completions",
  },
  {
    name: "Alibaba Cloud / Qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    api: "openai-completions",
  },
  {
    name: "Moonshot / Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    api: "openai-completions",
  },
  {
    name: "Zhipu / GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    api: "openai-completions",
  },
  {
    name: "SiliconFlow",
    baseUrl: "https://api.siliconflow.cn/v1",
    api: "openai-completions",
  },
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    api: "openai-responses",
  },
  {
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com",
    api: "anthropic-messages",
  },
  {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    api: "google-generative-ai",
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    api: "openai-completions",
  },
  { name: "xAI", baseUrl: "https://api.x.ai/v1", api: "openai-completions" },
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    api: "openai-completions",
  },
  {
    name: "Ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    api: "openai-completions",
  },
  {
    name: "LM Studio",
    baseUrl: "http://127.0.0.1:1234/v1",
    api: "openai-completions",
  },
  {
    name: "Kimi (Global)",
    baseUrl: "https://api.moonshot.ai/v1",
    api: "openai-completions",
  },
  {
    name: "Qwen (Global)",
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    api: "openai-completions",
  },
  {
    name: "Z.ai",
    baseUrl: "https://api.z.ai/api/paas/v4",
    api: "openai-completions",
  },
  {
    name: "MiniMax",
    baseUrl: "https://api.minimax.io/v1",
    api: "openai-completions",
  },
  {
    name: "MiniMax (China)",
    baseUrl: "https://api.minimax.cn/v1",
    api: "openai-completions",
  },
  {
    name: "StepFun",
    baseUrl: "https://api.stepfun.com/v1",
    api: "openai-completions",
  },
  {
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    api: "openai-completions",
  },
  {
    name: "Together AI",
    baseUrl: "https://api.together.ai/v1",
    api: "openai-completions",
  },
  {
    name: "Fireworks",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    api: "openai-completions",
  },
  {
    name: "AiHubMix",
    baseUrl: "https://aihubmix.com/v1",
    api: "openai-completions",
  },
  { name: "Custom endpoint", baseUrl: "", api: "openai-completions" },
] as const;

export type ConnectionPreset = (typeof CONNECTION_PRESETS)[number];
export const PROVIDER_CATEGORIES = [
  "Partners",
  "Subscription plans",
  "Direct providers",
  "Aggregators",
  "Local and custom",
] as const;
export function providerCategory(provider: {
  name: string;
  baseUrl: string;
}): (typeof PROVIDER_CATEGORIES)[number] {
  if (provider.baseUrl.includes("tokendance.space")) return "Partners";
  if (provider.baseUrl.includes("token-plan")) return "Subscription plans";
  if (
    !provider.baseUrl ||
    /^http:\/\/(localhost|127\.0\.0\.1)/.test(provider.baseUrl)
  )
    return "Local and custom";
  if (
    [
      "openrouter.ai",
      "siliconflow.cn",
      "together.ai",
      "fireworks.ai",
      "aihubmix.com",
    ].some((host) => provider.baseUrl.includes(host))
  )
    return "Aggregators";
  return "Direct providers";
}
