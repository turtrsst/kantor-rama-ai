import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { verifyJWT, extractToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers);
    let userId = token || "";
    if (!userId || userId.length < 5) { try { const payload = verifyJWT(token || ""); userId = payload.sub; } catch {} }
    const apiKey = userId || "";
    if (!apiKey) return NextResponse.json({ error: "Need auth" }, { status: 401 });
    const rows = await dbQuery("SELECT * FROM custom_routers WHERE user_api_key = ?", [apiKey]);
    return NextResponse.json({ data: rows || [], count: (rows || []).length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extractToken(req.headers);
    let userId = token || body.user_api_key || "";
    if (!userId || userId.length < 5) { try { const payload = verifyJWT(token || ""); userId = payload.sub; } catch {} }
    const apiKey = userId || "";
    if (!apiKey) return NextResponse.json({ error: "Need auth" }, { status: 400 });
    await dbQuery(
      `INSERT INTO custom_routers (user_api_key, router_name, model_id, endpoint, api_key, headers_json, free_tier, context_window, capabilities, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE endpoint = VALUES(endpoint), api_key = VALUES(api_key), headers_json = VALUES(headers_json), updated_at = NOW()`,
      [apiKey, body.router_name, body.model_id, body.endpoint, body.api_key || null, JSON.stringify(body.headers || {}), body.free_tier ?? 1, body.context_window ?? 8192, (body.capabilities || []).join(","), (body.tags || []).join(",")]
    );
    return NextResponse.json({ ok: true, message: "Custom router saved." });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extractToken(req.headers);
    let userId = token || body.user_api_key || "";
    if (!userId || userId.length < 5) { try { const payload = verifyJWT(token || ""); userId = payload.sub; } catch {} }
    const apiKey = userId || "";
    if (!apiKey) return NextResponse.json({ error: "Need auth" }, { status: 400 });
    await dbQuery("DELETE FROM custom_routers WHERE user_api_key = ? AND model_id = ?", [apiKey, body.model_id]);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
