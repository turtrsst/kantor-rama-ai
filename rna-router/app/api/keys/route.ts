import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";
import { verifyJWT, extractToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const token = extractToken(req.headers);
    let userId = token || "";
    if (!userId || userId.length < 5) {
      try { const payload = verifyJWT(token || ""); userId = payload.sub; } catch {}
    }
    const apiKey = userId || "";
    if (!apiKey) return NextResponse.json({ error: "Missing x-api-key / JWT" }, { status: 401 });
    const rows = await dbQuery("SELECT provider, created_at FROM user_keys WHERE user_api_key = ?", [apiKey]);
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
    if (!apiKey) return NextResponse.json({ error: "Need user_api_key / JWT" }, { status: 400 });
    await dbQuery(
      `INSERT INTO user_keys (user_api_key, provider, key_value, updated_at) VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE key_value = VALUES(key_value), updated_at = NOW()`,
      [apiKey, body.provider, body.key_value]
    );
    return NextResponse.json({ ok: true, message: "Key saved." });
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
    if (!apiKey) return NextResponse.json({ error: "Need user_api_key / JWT" }, { status: 400 });
    await dbQuery("DELETE FROM user_keys WHERE user_api_key = ? AND provider = ?", [apiKey, body.provider]);
    return NextResponse.json({ ok: true, deleted: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
