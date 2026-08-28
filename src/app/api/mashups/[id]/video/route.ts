import { NextResponse } from "next/server";
import { motionApiUrl, videoApiUrl } from "@/lib/api";
import { forwardAuth } from "@/lib/forward-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

function notDeployedResponse() {
  return NextResponse.json(
    {
      error:
        "Motion video API is not deployed yet. Fuse still uses the original Mashup API; Animate needs the mashup-studio-motion stack (VIDEO_API_URL).",
    },
    { status: 503 },
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!videoApiUrl()) return notDeployedResponse();
  try {
    const upstream = await fetch(`${motionApiUrl()}/mashups/${id}`, {
      cache: "no-store",
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video API unreachable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!videoApiUrl()) return notDeployedResponse();
  try {
    const payload = await request.json().catch(() => ({}));
    const upstream = await fetch(`${motionApiUrl()}/mashups/${id}/video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...forwardAuth(request),
      },
      body: JSON.stringify(payload),
    });
    const data = await upstream.json();
    if (upstream.status === 404) {
      return NextResponse.json(
        {
          error:
            data.error ||
            "This API does not support Animate. Set VIDEO_API_URL to the mashup-studio-motion HTTP API.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video API unreachable.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
