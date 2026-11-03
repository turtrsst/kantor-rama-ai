import { dbQuery } from "./db";
import { MODELS, ModelDef } from "./models";

export async function loadCustomRouters(userApiKey: string): Promise<ModelDef[]> {
  try {
    const rows = await dbQuery(
      "SELECT router_name as name, model_id as id, endpoint, api_key, headers_json, free_tier, context_window, capabilities, tags FROM custom_routers WHERE user_api_key = ?",
      [userApiKey]
    );
    return (rows || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      provider: "custom",
      endpoint: r.endpoint,
      freeTier: !!r.free_tier,
      contextWindow: r.context_window || 8192,
      capabilities: (r.capabilities || "").split(",").filter(Boolean),
      tags: (r.tags || "").split(",").filter(Boolean),
      icon: "⚡",
      // Custom fields stored separately
      customApiKey: r.api_key,
      customHeaders: r.headers_json ? (typeof r.headers_json === "string" ? JSON.parse(r.headers_json) : r.headers_json) : {},
    }));
  } catch {
    return [];
  }
}
