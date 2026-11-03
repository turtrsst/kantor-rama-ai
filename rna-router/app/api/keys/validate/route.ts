import { NextRequest, NextResponse } from "next/server";
import { getModel } from "@/lib/models";
import { callProvider } from "@/lib/adapters";
import { getServiceClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = body.user_api_key || "";
    const provider = body.provider || "muse";
    const modelId = body.model || body.model_id || "gemini-flash-1.5";
    
    // Fetch user's key value from DB
    const svc = getServiceClient();
    const { data } = await svc.from("user_keys").select("key_value").eq("user_api_key", apiKey).eq("provider", provider).single();
    
    if (!data?.key_value) {
      return NextResponse.json({ valid: false, error: "Key tidak ditemukan untuk provider ini" }, { status: 404 });
    }

    // Try quick validation call
    const result = await callProvider(modelId, {
      model: modelId,
      messages: [{ role: "user", content: "hi" }],
      temperature: 0.7,
    }, { [provider]: data.key_value });

    if (result.ok) {
      return NextResponse.json({ valid: true, provider, model: modelId, status: result.status });
    } else {
      return NextResponse.json({ valid: false, provider, model: modelId, status: result.status, detail: result.body });
    }
  } catch (e: any) {
    return NextResponse.json({ valid: false, error: e.message }, { status: 500 });
  }
}
