import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const rows = await dbQuery(
      "SELECT id, event, model, from_model, to_model, status, user_key, usage_tokens, created_at FROM gateway_logs ORDER BY created_at DESC LIMIT 5000"
    );
    const header = "id,event,model,from_model,to_model,status,user_key,usage_tokens,created_at\n";
    const lines = (rows || []).map((r: any) =>
      [
        r.id || "",
        r.event || "",
        r.model || "",
        r.from_model || "",
        r.to_model || "",
        r.status ?? "",
        r.user_key || "",
        r.usage_tokens ?? 0,
        r.created_at || "",
      ].join(",")
    );
    const csv = header + lines.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=rna-usage.csv",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
