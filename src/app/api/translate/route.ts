import { NextResponse } from "next/server";
import { fuseApiUrl } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") || "";
  const lang = params.get("lang") || "en";
  const upstream = await fetch(
    `${fuseApiUrl()}/translate?id=${encodeURIComponent(id)}&lang=${encodeURIComponent(lang)}`,
    { cache: "no-store" },
  );
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
