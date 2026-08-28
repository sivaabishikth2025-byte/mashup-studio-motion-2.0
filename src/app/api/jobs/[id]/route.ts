import { NextResponse } from "next/server";
import { fuseApiUrl } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const upstream = await fetch(`${fuseApiUrl()}/jobs/${id}`, {
    cache: "no-store",
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
