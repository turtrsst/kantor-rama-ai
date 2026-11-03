import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: "1.0.0",
    service: "RNA Router",
    timestamp: new Date().toISOString(),
    database: "mysql",
    features: ["openrouter-api", "auto-fallback", "multi-key", "usage-analytics", "custom-router", "widget"],
    uptime: process.uptime ? process.uptime() : 0,
  });
}
