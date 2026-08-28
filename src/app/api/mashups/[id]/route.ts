import { NextResponse } from "next/server";
import { fuseApiUrl, overlayMotionFields } from "@/lib/api";
import { forwardAuth } from "@/lib/forward-auth";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const upstream = await fetch(`${fuseApiUrl()}/mashups/${id}`, { cache: "no-store" });
    const data = await upstream.json();
    if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });
    const merged = await overlayMotionFields(id, data);
    return NextResponse.json(merged);
  } catch (err) {
    const message = err instanceof Error ? err.message : "API unreachable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const upstream = await fetch(`${fuseApiUrl()}/mashups/${id}`, {
      method: "DELETE",
      headers: forwardAuth(request),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "API unreachable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
