import { getModel, MODELS } from "./models";

export interface FallbackConfig {
  order: string[]; // model ids
  maxRetries: number;
  delayMs: number;
}

export const DEFAULT_FALLBACK: FallbackConfig = {
  order: ["muse-spark-1.2-free", "agnes-7b-instruct", "gemini-flash-1.5", "deepseek-chat", "kissing-kimi-k2"],
  maxRetries: 2,
  delayMs: 800,
};

export function getFallbackOrder(prefer?: string): string[] {
  if (prefer && getModel(prefer)) {
    const rest = DEFAULT_FALLBACK.order.filter((id) => id !== prefer);
    return [prefer, ...rest];
  }
  return DEFAULT_FALLBACK.order;
}

export function isRateLimitStatus(status: number, body?: any): boolean {
  if (status === 429) return true;
  if (status === 503 || status === 504) return true;
  const msg = String(body?.error?.message || body?.message || "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("quota") || msg.includes("throttle");
}
