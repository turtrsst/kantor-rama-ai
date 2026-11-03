import { NextRequest, NextResponse } from "next/server";
import { callProvider } from "@/lib/adapters";
import { getFallbackOrder, isRateLimitStatus } from "@/lib/fallback";
import { dbQuery } from "@/lib/db";
import { verifyJWT, extractToken, signJWT } from "@/lib/auth";
import { createSSEResponse } from "@/lib/stream";
import { exec } from "child_process";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const modelId = body.model || process.env.RNA_DEFAULT_MODEL || "muse-spark-1.2-free";
    const stream = body.stream || false;
    const userApiKey = req.headers.get("x-api-key") || body.api_key || "";
    const authHeader = req.headers.get("authorization") || "";
    let userId = userApiKey;
    if (authHeader.startsWith("Bearer ")) {
      try {
        const payload = verifyJWT(authHeader.slice(7));
        userId = payload.sub || userApiKey;
      } catch {}
    } else if (!userApiKey) {
      // For demo: allow anonymous but log; production require JWT
      userId = "anonymous-" + Date.now();
    }

    // Fetch user's provider keys from Supabase (key vault table)
    let userKeys: Record<string, string> = {};
    if (userId && userId.startsWith("rna-user")) {
      try {
        const rows = await dbQuery("SELECT provider, key_value FROM user_keys WHERE user_api_key = ?", [userId]);
        for (const r of (rows || [])) {
          userKeys[r.provider] = r.key_value || "";
        }
      } catch {}
    }

    // Primary attempt
    let result = await callProvider(modelId, body, userKeys);

    // Auto fallback on rate limit / upstream error
    if (!result.ok && isRateLimitStatus(result.status, result.body)) {
      const order = getFallbackOrder(modelId);
      for (const fallbackId of order) {
        if (fallbackId === modelId) continue;
        const fb = await callProvider(fallbackId, { ...body, model: fallbackId }, userKeys);
        if (fb.ok) {
          result = fb;
          // Notifikasi desktop saat fallback sukses
          exec(`bash scripts/notify-fallback.sh "${modelId}" "${fallbackId}" "${fb.status}"`);
          // Log fallback event
          try {
            await dbQuery(
              "INSERT INTO gateway_logs (event, from_model, to_model, status, user_key, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
              ["fallback", modelId, fallbackId, fb.status, userId || null]
            );
          } catch {}
          break;
        }
      }
    }

    // Real streaming via SSE
    if (stream) {
      const text = result.ok ? (result.body.choices?.[0]?.message?.content || "") : (result.body?.error?.message || "Maaf, terjadi error.");
      return createSSEResponse(text);
    }

    if (!result.ok) {
      return NextResponse.json(
        { error: "Upstream error", detail: result.body, provider: result.provider },
        { status: result.status || 502 }
      );
    }

    // Log usage
    try {
      await dbQuery(
        "INSERT INTO gateway_logs (event, model, status, user_key, usage_tokens, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        ["chat", modelId, result.status, userId || null, result.body.usage?.total_tokens || 0]
      );
    } catch {}

    return NextResponse.json(result.body);
  } catch (e: any) {
    return NextResponse.json({ error: "Internal error", message: e.message }, { status: 500 });
  }
}
