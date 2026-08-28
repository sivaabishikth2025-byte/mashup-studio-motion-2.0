"use client";

import { Header } from "@/components/header";
import { Particles } from "@/components/particles";
import { Button } from "@/components/ui/button";
import { authHeaders, getSession } from "@/lib/auth";
import type { GalleryItem } from "@/lib/types";
import { utcDateKey } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function GalleryPage() {
  const dateKey = utcDateKey();
  const [tab, setTab] = useState<"today" | "all">("today");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);

  function load() {
    const session = getSession();
    const inSession = Boolean(session?.accessToken);
    setSignedIn(inSession);
    setReady(true);
    if (!inSession) {
      setItems([]);
      setError(null);
      window.location.replace("/");
      return;
    }
    const qs = tab === "today" ? `?mine=1&date=${dateKey}` : "?mine=1";
    fetch(`/api/gallery${qs}`, { headers: authHeaders(), cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gallery unavailable.");
        setItems(data.items || []);
      })
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [tab, dateKey]);

  async function remove(id: string) {
    const res = await fetch(`/api/mashups/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete.");
      return;
    }
    setItems((curr) => curr.filter((item) => item.id !== id));
  }

  return (
    <div className="relative min-h-screen">
      <Particles />
      <Header />
      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-8">
        <h1 className="font-serif text-4xl md:text-6xl">Your gallery</h1>
        <p className="mt-3 max-w-2xl text-white/60">
          {signedIn
            ? "Only mashups you fused while signed in appear here. Nobody else can see this list."
            : "Sign in to see the mashups saved to your account. Signed out, this gallery stays empty."}
        </p>
        {!ready ? null : !signedIn ? (
          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 px-6 py-16 text-center">
            <p className="font-serif text-3xl">Private until you sign in</p>
            <p className="mx-auto mt-3 max-w-md text-white/55">
              Each account has its own gallery. Log out and these cards disappear.
            </p>
            <Button asChild variant="glow" className="mt-6">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-6 flex gap-2">
              <button
                className={`rounded-full px-4 py-2 text-sm ${tab === "today" ? "bg-white text-black" : "bg-white/10"}`}
                onClick={() => setTab("today")}
              >
                Today
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm ${tab === "all" ? "bg-white text-black" : "bg-white/10"}`}
                onClick={() => setTab("all")}
              >
                All time
              </button>
            </div>
            {error && <p className="mt-6 text-rose-300">{error}</p>}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                  <Link href={`/m/${item.id}`}>
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                      {item.videoUrl ? (
                        <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs uppercase tracking-wide text-cyan-200">
                          Video
                        </span>
                      ) : null}
                    </div>
                    <div className="p-4">
                      <h2 className="font-serif text-2xl">{item.name}</h2>
                      <p className="mt-1 text-sm text-white/60">{item.tagline}</p>
                    </div>
                  </Link>
                  <div className="px-4 pb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-rose-400/40 text-rose-200"
                      onClick={() => remove(item.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {!error && items.length === 0 && (
              <p className="mt-10 text-white/50">No mashups on this account yet. Fuse one in the studio.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
