export type ModelProvider = "muse" | "agnes" | "gemini" | "deepseek" | "kimi" | "openrouter";

export interface ModelDef {
  id: string; // OpenRouter-style id
  name: string;
  provider: string;
  endpoint: string;
  freeTier: boolean;
  contextWindow: number;
  capabilities: string[];
  tags: string[];
  icon: string;
}

export const MODELS = [
  {
    id: "muse-spark-1.2-free",
    name: "Muse Spark 1.2 (Free)",
    provider: "muse",
    endpoint: "https://muse-api.example.com/v1/chat/completions",
    freeTier: true,
    contextWindow: 32500,
    capabilities: ["chat", "code", "reasoning"],
    tags: ["free", "fast", "multilingual"],
    icon: "💡",
  },
  {
    id: "agnes-7b-instruct",
    name: "Agnes 7B Instruct",
    provider: "agnes",
    endpoint: "https://agnes-api.example.com/v1/chat/completions",
    freeTier: true,
    contextWindow: 8192,
    capabilities: ["chat", "instruction"],
    tags: ["free", "lightweight", "indonesian"],
    icon: "🤖",
  },
  {
    id: "gemini-flash-1.5",
    name: "Gemini Flash 1.5",
    provider: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    freeTier: true,
    contextWindow: 1048576,
    capabilities: ["multimodal", "long-context", "code"],
    tags: ["free", "google", "multimodal"],
    icon: "✨",
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "deepseek",
    endpoint: "https://api.deepseek.com/chat/completions",
    freeTier: true,
    contextWindow: 64000,
    capabilities: ["chat", "code", "reasoning", "math"],
    tags: ["free", "coder", "reasoning"],
    icon: "🐋",
  },
  {
    id: "kissing-kimi-k2",
    name: "Kimi K2 (Moonshot)",
    provider: "kimi",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    freeTier: true,
    contextWindow: 256000,
    capabilities: ["long-context", "chat", "code"],
    tags: ["free", "long-context", "chinese"],
    icon: "🌙",
  },
  {
    id: "openrouter/anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet (OpenRouter)",
    provider: "openrouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    freeTier: false,
    contextWindow: 200000,
    capabilities: ["chat", "code", "vision"],
    tags: ["paid", "top-tier"],
    icon: "🧠",
  },
,
  { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Free/Groq)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","code","reasoning"], tags: ["free","open-source","groq"], icon: "🧠" },
  { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Free/Groq)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","code","reasoning"], tags: ["free","open-source","fast"], icon: "🧠" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct (Free/Groq)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","code","reasoning","multilingual"], tags: ["free","meta","open"], icon: "🦙" },
  { id: "meta-llama/llama-4-scout", name: "Llama 4 Scout (Free)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 10000000, capabilities: ["chat","multimodal","long-context"], tags: ["free","meta","moe"], icon: "🦙" },
  { id: "meta-llama/llama-3.1-405b-instruct", name: "Llama 3.1 405B Instruct (Free/GitHub)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","code","reasoning"], tags: ["free","meta","large"], icon: "🦙" },
  { id: "mistralai/mistral-small-3.1", name: "Mistral Small 3.1 (Free)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","multimodal","code"], tags: ["free","mistral","hybrid"], icon: "🍃" },
  { id: "qwen/qwen3-32b", name: "Qwen3 32B (Free/Groq)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 131072, capabilities: ["chat","code","reasoning","multilingual"], tags: ["free","qwen","coder"], icon: "⚡" },
  { id: "qwen/qwen3-8b", name: "Qwen3 8B (Free/Groq)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 131072, capabilities: ["chat","code","fast"], tags: ["free","qwen","lightweight"], icon: "⚡" },
  { id: "deepseek/deepseek-v4-flash", name: "DeepSeek V4 Flash (Free)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 64000, capabilities: ["chat","code","reasoning"], tags: ["free","deepseek","fast"], icon: "🐋" },
  { id: "gemma-4-12b", name: "Gemma 4 12B (Free/Google)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 256000, capabilities: ["chat","multimodal","vision"], tags: ["free","google","multimodal"], icon: "✨" },
  { id: "gemma-3-12b-it", name: "Gemma 3 12B Instruct (Free)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","code","multimodal"], tags: ["free","google","multimodal"], icon: "✨" },
  { id: "nvidia/nemotron-3-5-lightning-free", name: "Nemotron 3.5 Lightning (Free/NVIDIA)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","code","reasoning"], tags: ["free","nvidia","fast"], icon: "⚡" },
  { id: "cohere/command-r-plus", name: "Cohere Command R+ (Free)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","multilingual","rag"], tags: ["free","cohere","enterprise"], icon: "🏢" },
  { id: "nousresearch/hermes-3-llama-3.1-405b", name: "Hermes 3 Llama 3.1 405B (Free)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","agentic","long-context"], tags: ["free","nous","agentic"], icon: "🌙" },
  { id: "microsoft/phi-4-14b", name: "Phi-4 14B (Free/Microsoft)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 16000, capabilities: ["chat","code","reasoning","on-device"], tags: ["free","microsoft","small"], icon: "🔷" },
  { id: "arcee-ai/trinity-large-preview:free", name: "Arcee AI Trinity Large (Free)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 256000, capabilities: ["chat","code","multilingual"], tags: ["free","arcee","enterprise"], icon: "🛡️" },
  { id: "minimax/minimax-m2.5:free", name: "Minimax M2.5 (Free)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","multimodal","fast"], tags: ["free","minimax","china"], icon: "🎯" },
  { id: "openai/gpt-4o", name: "GPT-4o (Free tier / OpenRouter)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","vision","multimodal"], tags: ["free","openai","vision"], icon: "👁️" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini (Free/OpenRouter)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","vision","fast"], tags: ["free","openai","lightweight"], icon: "👁️" },
  { id: "github/llama-3.2-11b-vision-instruct", name: "Llama 3.2 11B Vision (Free/GitHub)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","vision","multimodal"], tags: ["free","github","vision"], icon: "📸" },
  { id: "github/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct (Free/GitHub)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 128000, capabilities: ["chat","code","reasoning"], tags: ["free","github","meta"], icon: "🦙" },
  { id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free", name: "Dolphin Mistral 24B (Free)", provider: "openrouter", endpoint: "https://openrouter.ai/api/v1/chat/completions", freeTier: true, contextWindow: 32000, capabilities: ["chat","code","uncensored"], tags: ["free","dolphin","coding"], icon: "🐬" }
];

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m: any) => m && (m.id === id || m.id.includes(id))) as ModelDef | undefined;
}

export function searchModels(query: string): ModelDef[] {
  const q = query.toLowerCase();
  return (MODELS.filter(
    (m: any) =>
      m.name.toLowerCase().includes(q) ||
      (m.tags || []).some((t: any) => t.includes(q)) ||
      (m.capabilities || []).some((c: any) => c.includes(q)) ||
      (m.provider || "").includes(q)
  ) as ModelDef[]);
}
