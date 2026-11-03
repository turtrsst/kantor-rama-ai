import { getModel } from "./models";

export interface ProxyReq {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ProxyResp {
  id: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model?: string;
}

// User-provided keys from Supabase (key vault)
export async function callProvider(
  modelId: string,
  payload: ProxyReq,
  userKeys?: Record<string, string>
): Promise<{ ok: boolean; status: number; body: any; provider?: string }> {
  const model = getModel(modelId);
  if (!model) return { ok: false, status: 404, body: { error: "Model not found" } };

  const provider = model.provider;
  let url = model.endpoint;
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  if ((model as any).customHeaders) {
    for (const [k,v] of Object.entries((model as any).customHeaders || {})) headers[k] = String(v);
  }
  let body: any = payload;

  // Key management: try user key first, then env/default keys
  let key = userKeys?.[provider] || process.env[`${provider.toUpperCase()}_API_KEY`] || "";
  if ((model as any).customApiKey) { key = (model as any).customApiKey; }
  if (key) {
    if (provider === "gemini") {
      url = `${url}?key=${key}`;
    } else if (provider === "kimi") {
      headers["Authorization"] = `Bearer ${key}`;
    } else if (provider === "muse" || provider === "agnes" || provider === "deepseek") {
      headers["Authorization"] = `Bearer ${key}`;
    } else {
      headers["Authorization"] = `Bearer ${key}`;
    }
  }

  // Provider-specific payload transforms
  if (provider === "gemini") {
    // Gemini uses contents array, not messages
    const contents = payload.messages.map((m) => ({ role: m.role === "system" ? "user" : m.role, parts: [{ text: m.content }] }));
    body = {
      contents,
      generationConfig: { temperature: payload.temperature ?? 0.7, maxOutputTokens: payload.max_tokens ?? 1024 },
    };
    headers["x-goog-api-key"] = key || "";
  } else if (provider === "muse") {
    // Muse expects openrouter-compatible payload mostly
    body = { ...payload, model: modelId };
  } else if (provider === "agnes") {
    body = { ...payload, model: model.id };
  } else if (provider === "deepseek") {
    body = { ...payload, model: modelId };
  } else if (provider === "kimi") {
    body = { ...payload, model: modelId };
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    // Normalize gemini response to openrouter shape
    if (provider === "gemini" && data.candidates) {
      const text = data.candidates[0]?.content?.parts?.[0]?.text || "";
      return {
        ok: res.ok,
        status: res.status,
        body: {
          id: `gemini-${Date.now()}`,
          choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
          usage: data.usageMetadata || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: modelId,
        },
        provider,
      };
    }
    return { ok: res.ok, status: res.status, body: data, provider };
  } catch (e: any) {
    return { ok: false, status: 502, body: { error: e.message || "Upstream error" }, provider };
  }
}
