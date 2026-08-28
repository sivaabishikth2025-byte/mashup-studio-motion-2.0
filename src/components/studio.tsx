"use client";

import { FuseLoader } from "@/components/fuse-loader";
import { Header } from "@/components/header";
import { Particles } from "@/components/particles";
import { Button } from "@/components/ui/button";
import { CATEGORIES, INGREDIENTS, type Ingredient } from "@/lib/catalog";
import { dailyIngredients } from "@/lib/daily";
import { getSession, authHeaders } from "@/lib/auth";
import { utcDateKey } from "@/lib/utils";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Camera, ImagePlus, Lock, Search, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Mode = "daily" | "sandbox";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForJob(jobId: string) {
  const started = Date.now();
  while (Date.now() - started < 170000) {
    const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
    const job = await res.json();
    if (!res.ok) throw new Error(job.error || "Job lookup failed.");
    if (job.status === "COMPLETE" && job.mashupId) {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Your mashup is ready", {
          body: "Open Infinite Mashup Motion to see the image, story, and video.",
        });
      }
      return job.mashupId as string;
    }
    if (job.status === "FAILED") {
      throw new Error(job.error || "Fusion failed.");
    }
    await sleep(2000);
  }
  throw new Error("Fusion timed out. Try again.");
}

export function Studio() {
  const router = useRouter();
  const dateKey = utcDateKey();
  const daily = useMemo(() => dailyIngredients(dateKey), [dateKey]);
  const [mode, setMode] = useState<Mode>("daily");
  const [extras, setExtras] = useState<Ingredient[]>([]);
  const [sandbox, setSandbox] = useState<Ingredient[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number] | "All">(
    "All",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eta, setEta] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [used, setUsed] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [photos, setPhotos] = useState<string[]>([]);
  const [camOn, setCamOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const next = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
      );
      const ms = next - now.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setEta(`${h}h ${m}m until a new daily trio`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const session = getSession();
    const qs = new URLSearchParams();
    if (session?.accessToken) qs.set("accessToken", session.accessToken);
    if (session?.idToken) qs.set("idToken", session.idToken);
    fetch(`/api/quota?${qs.toString()}`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) return;
        setRemaining(typeof data.remaining === "number" ? data.remaining : null);
        if (typeof data.used === "number") setUsed(data.used);
        if (typeof data.limit === "number") setDailyLimit(data.limit);
      })
      .catch(() => undefined);
  }, []);

  const selected = mode === "daily" ? [...daily, ...extras] : sandbox;

  const filtered = INGREDIENTS.filter((item) => {
    if (selected.some((d) => d.id === item.id)) return false;
    if (category !== "All" && item.category !== category) return false;
    if (!query.trim()) return true;
    return item.label.toLowerCase().includes(query.toLowerCase());
  });

  function add(item: Ingredient) {
    if (selected.length >= 5) return;
    if (mode === "daily") setExtras((curr) => [...curr, item]);
    else setSandbox((curr) => [...curr, item]);
  }

  function remove(id: string) {
    if (mode === "daily") setExtras((curr) => curr.filter((x) => x.id !== id));
    else setSandbox((curr) => curr.filter((x) => x.id !== id));
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setCamOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setError("Camera permission was denied.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || photos.length >= 2) return;
    const canvas = document.createElement("canvas");
    const w = Math.min(video.videoWidth || 1280, 1280);
    const h = Math.round(((video.videoHeight || 720) / (video.videoWidth || 1280)) * w);
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
    setPhotos((curr) => [...curr, canvas.toDataURL("image/jpeg", 0.72)]);
  }

  async function addUploadedFiles(files: FileList | null) {
    if (!files) return;
    const room = 2 - photos.length;
    const chosen = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, room);
    const next: string[] = [];
    for (const file of chosen) {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const w = Math.min(bitmap.width, 1280);
      const h = Math.round((bitmap.height / bitmap.width) * w) || 720;
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      next.push(canvas.toDataURL("image/jpeg", 0.72));
    }
    if (next.length) setPhotos((curr) => [...curr, ...next].slice(0, 2));
  }

  const canFuse =
    remaining !== 0 &&
    (mode === "daily"
      ? selected.length >= 2 && selected.length <= 5
      : selected.length <= 5 && (photos.length >= 1 || (selected.length >= 2 && selected.length <= 5)));

  async function fuse() {
    setBusy(true);
    setError(null);
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      const res = await fetch("/api/fuse", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ingredientIds: selected.map((s) => s.id),
          challengeDate: mode === "daily" ? dateKey : "sandbox",
          mode,
          photos: mode === "sandbox" ? photos : [],
          accessToken: getSession()?.accessToken,
          idToken: getSession()?.idToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fusion failed.");
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (typeof data.used === "number") setUsed(data.used);
      else if (typeof data.remaining === "number") setUsed(dailyLimit - data.remaining);
      const mashupId = await waitForJob(data.jobId);
      confetti({
        particleCount: 180,
        spread: 86,
        origin: { y: 0.32 },
        colors: ["#22d3ee", "#e879f9", "#fbbf24"],
      });
      router.push(`/m/${mashupId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fusion failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Particles />
      <FuseLoader active={busy} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.28),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(34,211,238,0.18),transparent_35%)]" />
      <Header />

      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-8">
        <p className="text-center text-xs uppercase tracking-[0.35em] text-cyan-300">
          {mode === "daily" ? `Daily challenge · ${dateKey}` : "Sandbox studio"}
        </p>
        <h1 className="mt-4 text-center font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">
          Infinite Mashup Studio
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-center text-lg text-white/65">
          Create things that should never exist.
        </p>
        <p className="mt-2 text-center text-xs text-white/40">{eta}</p>

        <div className="mt-8 flex justify-center gap-2">
          <ModeChip active={mode === "daily"} onClick={() => setMode("daily")}>
            Daily challenge
          </ModeChip>
          <ModeChip active={mode === "sandbox"} onClick={() => setMode("sandbox")}>
            Sandbox
          </ModeChip>
        </div>

        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-3">
          {mode === "daily" &&
            daily.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm backdrop-blur-xl"
              >
                <Lock className="h-3.5 w-3.5 text-amber-300" />
                <span className="text-lg">{item.emoji}</span>
                {item.label}
              </span>
            ))}
          {(mode === "daily" ? extras : sandbox).map((item) => (
            <button
              key={item.id}
              className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/15 px-4 py-2 text-sm"
              onClick={() => remove(item.id)}
            >
              <span className="text-lg">{item.emoji}</span>
              {item.label}
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-white/50">
          {mode === "daily"
            ? "Everyone gets the same three locked ingredients today. Add up to two more, then fuse. Art, story, and narration are generated live."
            : "Pick 2–5 ingredients, or add up to 2 photos from camera or upload and mix them with the catalog."}
        </p>

        {mode === "sandbox" && (
          <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-white/70">Photos ({photos.length}/2)</p>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addUploadedFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={photos.length >= 2}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" /> Upload
                </Button>
                {!camOn ? (
                  <Button variant="glow" size="sm" onClick={startCamera}>
                    <Camera className="h-4 w-4" /> Camera
                  </Button>
                ) : (
                  <button className="text-xs text-white/50 underline" onClick={stopCamera}>
                    Close camera
                  </button>
                )}
              </div>
            </div>
            {camOn && (
              <div className="mt-3">
                <video ref={videoRef} autoPlay playsInline className="w-full rounded-2xl bg-black" />
                <Button className="mt-3" disabled={photos.length >= 2} onClick={capturePhoto}>
                  Capture photo
                </Button>
              </div>
            )}
            {photos.length > 0 && (
              <div className="mt-3 flex gap-2">
                {photos.map((src, i) => (
                  <button key={i} onClick={() => setPhotos((curr) => curr.filter((_, idx) => idx !== i))}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-20 w-28 rounded-xl object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-10 flex flex-col items-center gap-3">
          <Button
            variant="glow"
            size="lg"
            onClick={fuse}
            disabled={busy || !canFuse}
          >
            <Sparkles className="h-5 w-5" /> Fuse
          </Button>
          <p className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/45">
            {remaining === 0
              ? `Daily limit reached · ${used}/${dailyLimit} used`
              : remaining === null
                ? `${dailyLimit} fuses / day`
                : `${used} used · ${remaining} left today`}
          </p>
        </div>
        {error && (
          <p className="mt-4 text-center text-sm text-rose-300">{error}</p>
        )}

        <section className="mt-16 rounded-[2rem] border border-white/10 bg-black/30 p-5 backdrop-blur-xl md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search animals, foods, places..."
                className="h-12 w-full rounded-full border border-white/10 bg-white/5 pl-11 pr-4 outline-none ring-cyan-300 focus:ring-2"
              />
            </div>
            <p className="text-sm text-white/40">{selected.length}/5 ingredients</p>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            <FilterChip active={category === "All"} onClick={() => setCategory("All")}>
              All
            </FilterChip>
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c}
                active={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </FilterChip>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={selected.length >= 5}
                onClick={() => add(item)}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:border-cyan-300/40 disabled:opacity-40"
              >
                <span className="text-2xl">{item.emoji}</span>
                <p className="mt-2 font-medium">{item.label}</p>
                <p className="text-xs text-white/40">{item.category}</p>
              </motion.button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs ${
        active ? "bg-white text-black" : "bg-white/5 text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

function ModeChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm ${
        active
          ? "bg-white text-black"
          : "border border-white/10 bg-white/5 text-white/70"
      }`}
    >
      {children}
    </button>
  );
}
