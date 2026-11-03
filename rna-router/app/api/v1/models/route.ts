import { NextResponse } from "next/server";
import { MODELS, searchModels } from "@/lib/models";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const data = q ? searchModels(q) : MODELS;
  return NextResponse.json({ data, object: "list" });
}
