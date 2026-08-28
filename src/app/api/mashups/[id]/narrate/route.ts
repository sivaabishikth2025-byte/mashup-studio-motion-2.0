import { NextResponse } from "next/server";
import { motionApiUrl } from "@/lib/api";
import { forwardAuth } from "@/lib/forward-auth";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const payload = await request.json().catch(() => ({}));
    const upstream = await fetch(`${motionApiUrl()}/mashups/${id}/narrate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...forwardAuth(request),
      },
      body: JSON.stringify(payload),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Narrate API unreachable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
