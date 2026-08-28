"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authHeaders, getSession } from "@/lib/auth";
import { storyVideoSeconds } from "@/lib/api";
import type { Mashup } from "@/lib/types";
import { motion } from "framer-motion";
import { Clapperboard, Copy, Download, Pause, Play, RefreshCw, Share2, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";

const MOTION = [
  { id: "cinematic", label: "Cinematic" },
  { id: "playful", label: "Playful" },
  { id: "ominous", label: "Ominous" },
];

const VOICES = ["Ruth", "Matthew", "Joanna", "Danielle", "Stephen"];

const LANGS = [
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "pt", label: "Português" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "zh", label: "中文" },
  { id: "hi", label: "हिन्दी" },
  { id: "ar", label: "العربية" },
];

export function ResultView({ mashup: initial }: { mashup: Mashup }) {
  const router = useRouter();
  const [mashup, setMashup] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [style, setStyle] = useState(initial.videoStyle || "cinematic");
  const [voice, setVoice] = useState(initial.voiceId || "Ruth");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState(initial.videoError || "");
  const [renderSeconds, setRenderSeconds] = useState(initial.videoSeconds || 0);
  const estimatedSeconds = mashup.videoSeconds || storyVideoSeconds(mashup.origin || mashup.tagline || "");
  const estimatedShots = Math.max(1, Math.round((renderSeconds || estimatedSeconds) / 6));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scoreRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    setSignedIn(Boolean(getSession()?.accessToken));
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const score = scoreRef.current;
    if (!video || !score || !mashup.musicUrl) return;
    const play = () => {
      score.currentTime = video.currentTime;
      score.play().catch(() => undefined);
    };
    const pause = () => score.pause();
    const seek = () => {
      score.currentTime = video.currentTime;
    };
    video.addEventListener("play", play);
    video.addEventListener("pause", pause);
    video.addEventListener("seeking", seek);
    video.addEventListener("ended", pause);
    return () => {
      video.removeEventListener("play", play);
      video.removeEventListener("pause", pause);
      video.removeEventListener("seeking", seek);
      video.removeEventListener("ended", pause);
    };
  }, [mashup.musicUrl, mashup.videoUrl]);

  const cards = useMemo(
    () => [
      { title: "Origin Story", body: mashup.origin },
      { title: "Abilities", body: mashup.abilities.map((a) => `• ${a}`).join("\n") },
      { title: "Personality", body: mashup.personality },
      { title: "Fun Facts", body: mashup.facts.map((a) => `• ${a}`).join("\n") },
      { title: "Advertisement", body: mashup.advertisement },
      { title: "Warning Label", body: mashup.warning },
      {
        title: "Scientific Classification",
        body: [
          `Kingdom: ${mashup.classification.kingdom}`,
          `Species: ${mashup.classification.species}`,
          `Habitat: ${mashup.classification.habitat}`,
          `Diet: ${mashup.classification.diet}`,
          `Lifespan: ${mashup.classification.lifespan}`,
          `Threat Level: ${mashup.classification.threatLevel}`,
        ].join("\n"),
      },
      { title: "Patent Summary", body: mashup.patent },
    ],
    [mashup],
  );

  async function copyStory() {
    await navigator.clipboard.writeText(
      [mashup.name, mashup.tagline, "", mashup.origin, "", mashup.personality, "", mashup.patent].join("\n"),
    );
  }

  async function share() {
    const url = `${window.location.origin}/m/${mashup.id}`;
    if (navigator.share) {
      await navigator.share({ title: mashup.name, url, text: mashup.tagline });
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  async function downloadImage() {
    const res = await fetch(mashup.imageUrl);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${mashup.name.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.click();
    URL.revokeObjectURL(href);
  }

  function toggleAudio() {
    if (!mashup.audioUrl) return;
    if (!audioRef.current) audioRef.current = new Audio(mashup.audioUrl);
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
      return;
    }
    audioRef.current.play();
    audioRef.current.onended = () => setPlaying(false);
    setPlaying(true);
  }

  async function translateTo(lang: string) {
    const res = await fetch(`/api/translate?id=${mashup.id}&lang=${lang}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Translate failed.");
    setMashup(data);
  }

  async function remove() {
    const res = await fetch(`/api/mashups/${mashup.id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not delete.");
    router.push("/gallery");
  }

  async function pollMashup() {
    const started = Date.now();
    while (Date.now() - started < 1080000) {
      const res = await fetch(`/api/mashups/${mashup.id}/video`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load mashup video.");
      setMashup((curr) => ({ ...curr, ...data }));
      if (data.videoStatus === "COMPLETE" && data.videoUrl) return data as Mashup;
      if (data.videoStatus === "FAILED") throw new Error(data.videoError || "Video failed.");
      await new Promise((r) => setTimeout(r, 6000));
    }
    throw new Error("Video is still rendering. Refresh in a minute — longer origin stories take longer.");
  }

  async function animate(again = false) {
    setVideoBusy(true);
    setVideoError("");
    try {
      const estimated = storyVideoSeconds(mashup.origin || mashup.tagline || "");
      setRenderSeconds(estimated);
      const res = await fetch(`/api/mashups/${mashup.id}/video`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          style,
          again,
          mashup: {
            id: mashup.id,
            name: mashup.name,
            tagline: mashup.tagline,
            origin: mashup.origin,
            imageUrl: mashup.imageUrl,
            abilities: mashup.abilities,
            personality: mashup.personality,
            facts: mashup.facts,
            advertisement: mashup.advertisement,
            warning: mashup.warning,
            classification: mashup.classification,
            patent: mashup.patent,
            ingredients: mashup.ingredients,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start video.");
      if (data.seconds) setRenderSeconds(Number(data.seconds));
      if (data.musicUrl) {
        setMashup((curr) => ({ ...curr, musicUrl: data.musicUrl, videoSeconds: data.seconds }));
      }
      if (data.status === "COMPLETE" && data.videoUrl) {
        setMashup((curr) => ({
          ...curr,
          videoUrl: data.videoUrl,
          videoStatus: "COMPLETE",
          musicUrl: data.musicUrl || curr.musicUrl,
          videoSeconds: data.seconds || curr.videoSeconds,
        }));
        return;
      }
      const next = await pollMashup();
      setMashup((curr) => ({ ...curr, ...next }));
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Video failed.");
    } finally {
      setVideoBusy(false);
    }
  }

  async function downloadFile(url: string, filename: string) {
    const res = await fetch(url);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
  }

  async function downloadVideo() {
    if (!mashup.videoUrl) return;
    await downloadFile(mashup.videoUrl, `${mashup.name.replace(/\s+/g, "-").toLowerCase()}.mp4`);
  }

  async function changeVoice(next: string) {
    const previous = voice;
    setVoice(next);
    try {
      const res = await fetch(`/api/mashups/${mashup.id}/narrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          voice: next,
          mashup: {
            id: mashup.id,
            name: mashup.name,
            tagline: mashup.tagline,
            origin: mashup.origin,
            imageUrl: mashup.imageUrl,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not re-voice.");
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlaying(false);
      }
      setMashup((curr) => ({ ...curr, audioUrl: data.audioUrl, voiceId: data.voiceId }));
    } catch (err) {
      setVoice(previous);
      setVideoError(err instanceof Error ? err.message : "Could not re-voice.");
    }
  }

  async function remix() {
    if (!mashup.ingredientIds?.length) {
      router.push("/");
      return;
    }
    setBusy(true);
    try {
      const session = getSession();
      const res = await fetch("/api/fuse", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ingredientIds: mashup.ingredientIds,
          challengeDate: mashup.challengeDate,
          mode: mashup.mode || "daily",
          accessToken: session?.accessToken,
          idToken: session?.idToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const started = Date.now();
      while (Date.now() - started < 170000) {
        const jobRes = await fetch(`/api/jobs/${data.jobId}`, { cache: "no-store" });
        const job = await jobRes.json();
        if (job.status === "COMPLETE") {
          confetti({ particleCount: 120, spread: 70, origin: { y: 0.3 } });
          router.push(`/m/${job.mashupId}`);
          return;
        }
        if (job.status === "FAILED") throw new Error(job.error);
        await new Promise((r) => setTimeout(r, 2000));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/5"
      >
        <div className="relative aspect-square w-full bg-black md:aspect-[16/9]">
          <Image
            src={mashup.imageUrl}
            alt={mashup.name}
            fill
            unoptimized
            className="object-cover"
            priority
          />
          <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs uppercase tracking-wide text-cyan-200">
            Still
          </span>
        </div>
        <div className="p-6 md:p-8">
          <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">
            {mashup.ingredients.join("  +  ")}
          </p>
          <h1 className="mt-3 font-serif text-5xl tracking-tight md:text-7xl">
            {mashup.name}
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-white/70">{mashup.tagline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="glow" onClick={remix} disabled={busy}>
              <Sparkles className="h-4 w-4" /> Remix
            </Button>
            <Button variant="ghost" onClick={() => router.push("/")}>
              <RefreshCw className="h-4 w-4" /> New fuse
            </Button>
            {mashup.audioUrl && (
              <Button variant="ghost" onClick={toggleAudio}>
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                Listen
              </Button>
            )}
            <Button variant="ghost" onClick={share}>
              <Share2 className="h-4 w-4" /> Share
            </Button>
            <Button variant="glow" onClick={() => animate(Boolean(mashup.videoUrl))} disabled={videoBusy}>
              <Clapperboard className="h-4 w-4" />
              {videoBusy
                ? `Rendering ~${renderSeconds || estimatedSeconds}s story…`
                : mashup.videoUrl
                  ? "Regenerate story video"
                  : `Animate ${estimatedSeconds}s story`}
            </Button>
            <Button variant="ghost" onClick={downloadImage}>
              <Download className="h-4 w-4" /> Download Image
            </Button>
            {mashup.videoUrl && (
              <Button variant="ghost" onClick={downloadVideo}>
                <Download className="h-4 w-4" /> Download Video
              </Button>
            )}
            {mashup.musicUrl && (
              <Button variant="ghost" onClick={() => downloadFile(mashup.musicUrl!, "score.wav")}>
                <Download className="h-4 w-4" /> Download AI score
              </Button>
            )}
            <Button variant="ghost" onClick={copyStory}>
              <Copy className="h-4 w-4" /> Copy Story
            </Button>
            {signedIn && (
              <Button
                variant="ghost"
                className="border border-rose-400/40 text-rose-200"
                onClick={remove}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="block text-xs uppercase tracking-[0.2em] text-white/40">
              Motion style
              <select
                className="mt-2 block w-full rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              >
                {MOTION.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs uppercase tracking-[0.2em] text-white/40">
              Origin voice
              <select
                className="mt-2 block w-full rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
                value={voice}
                onChange={(e) => changeVoice(e.target.value)}
              >
                {VOICES.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {videoError && <p className="mt-3 text-sm text-rose-300">{videoError}</p>}
          {videoBusy && (
            <p className="mt-3 text-sm text-cyan-200">
              Nova Reel is shooting the origin story as {estimatedShots} clip
              {estimatedShots === 1 ? "" : "s"} (~{renderSeconds || estimatedSeconds}s total).
              Longer stories take several minutes. An original score is composed to match that length.
            </p>
          )}
          {mashup.musicUrl && (
            <>
              <audio ref={scoreRef} src={mashup.musicUrl} loop preload="auto" />
              <p className="mt-3 text-sm text-white/55">
                Original AI score for this invention. Play the video to hear it. No copyrighted recordings.
              </p>
            </>
          )}
          <label className="mt-6 block text-xs uppercase tracking-[0.2em] text-white/40">
            Translate dossier
            <select
              className="mt-2 block rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm text-white"
              defaultValue={mashup.language || "en"}
              onChange={(e) => translateTo(e.target.value)}
            >
              {LANGS.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/5"
      >
        <div className="relative aspect-video w-full bg-black">
          {mashup.videoUrl ? (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              src={mashup.videoUrl}
              poster={mashup.imageUrl}
              controls
              playsInline
              loop
              muted={Boolean(mashup.musicUrl)}
            />
          ) : (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-fuchsia-300">Motion reel</p>
              <p className="mt-3 max-w-md text-white/60">
                The still stays. Animate turns the origin story into a video — about six seconds per story beat, so a longer origin makes a longer clip.
              </p>
            </div>
          )}
          <span className="absolute left-4 top-4 rounded-full bg-black/70 px-3 py-1 text-xs uppercase tracking-wide text-fuchsia-200">
            Motion
          </span>
        </div>
      </motion.div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i }}
          >
            <Card className="h-full">
              <p className="text-xs uppercase tracking-[0.2em] text-fuchsia-300">
                {card.title}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-white/85">{card.body}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
