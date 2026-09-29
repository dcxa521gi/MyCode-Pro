import { setConnectionModels } from "../../sessions/model/models";
import { invoke } from "@tauri-apps/api/core";

export type ModelConnection = {
  id: string;
  name: string;
  baseUrl: string;
  api: string;
  models: string[];
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
  { name: "Custom endpoint", baseUrl: "", api: "openai-completions" },
] as const;
