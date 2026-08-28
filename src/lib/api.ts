const DEFAULT_FUSE_API =
  "https://1gp21rrv70.execute-api.us-east-1.amazonaws.com";

export function fuseApiUrl() {
  const url =
    process.env.FUSE_API_URL ||
    process.env.NEXT_PUBLIC_FUSE_API_URL ||
    DEFAULT_FUSE_API;
  return url.replace(/\/$/, "");
}

export function videoApiUrl() {
  const url =
    process.env.VIDEO_API_URL ||
    process.env.NEXT_PUBLIC_VIDEO_API_URL ||
    "";
  return url.replace(/\/$/, "");
}

/** Motion stack for video/score; falls back to fuse only if Motion is not configured. */
export function motionApiUrl() {
  return videoApiUrl() || fuseApiUrl();
}

export function storyVideoSeconds(origin: string, maxShots = 6) {
  const words = origin.trim().split(/\s+/).filter(Boolean).length;
  const shots = Math.max(1, Math.min(maxShots, Math.floor((words + 39) / 40)));
  return shots * 6;
}

export async function overlayMotionFields<T extends object>(id: string, mashup: T): Promise<T> {
  const base = videoApiUrl();
  if (!base) return mashup;
  try {
    const res = await fetch(`${base}/mashups/${id}`, { cache: "no-store" });
    if (!res.ok) return mashup;
    const motion = (await res.json()) as Record<string, unknown>;
    return {
      ...mashup,
      videoUrl: motion.videoUrl || (mashup as { videoUrl?: string }).videoUrl,
      videoStatus: motion.videoStatus || (mashup as { videoStatus?: string }).videoStatus,
      videoError: motion.videoError || (mashup as { videoError?: string }).videoError,
      videoStyle: motion.videoStyle || (mashup as { videoStyle?: string }).videoStyle,
      videoSeconds: motion.videoSeconds || (mashup as { videoSeconds?: number }).videoSeconds,
      musicUrl: motion.musicUrl || (mashup as { musicUrl?: string }).musicUrl,
      videoBeats: motion.videoBeats || (mashup as { videoBeats?: string[] }).videoBeats,
    };
  } catch {
    return mashup;
  }
}
