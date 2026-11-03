import { NextRequest, NextResponse } from "next/server";
import { signJWT } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sub = body.sub || "anonymous";
    const token = signJWT(sub, "7d");
    return NextResponse.json({ token, sub, expires_in: "7d" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
