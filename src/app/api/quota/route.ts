import { NextResponse } from "next/server";
import { fuseApiUrl } from "@/lib/api";
import { forwardAuth } from "@/lib/forward-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const upstream = await fetch(`${fuseApiUrl()}/quota${incoming.search}`, {
    cache: "no-store",
    headers: forwardAuth(request),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
