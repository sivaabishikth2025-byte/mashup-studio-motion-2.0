"use client";

import { AuthPanel } from "@/components/auth-panel";
import { Header } from "@/components/header";
import { Particles } from "@/components/particles";
import { Button } from "@/components/ui/button";
import { authHeaders, getSession, signOut } from "@/lib/auth";
import type { GalleryItem } from "@/lib/types";
import { utcDateKey } from "@/lib/utils";
import { motion } from "framer-motion";
import { Bell, Mail, Sparkles, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    const session = getSession();
    setEmail(session?.email || null);
    if (!session) {
      setItems([]);
      setLoading(false);
      window.location.replace("/");
      return;
    }
    setLoading(true);
    fetch("/api/gallery?mine=1", { headers: authHeaders(), cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load profile.");
        setItems(data.items || []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const today = utcDateKey();
  const todayCount = useMemo(
    () => items.filter((item) => (item.createdAt || "").startsWith(today)).length,
    [items, today],
  );
  const initial = (email?.[0] || "M").toUpperCase();
  const handle = email ? email.split("@")[0] : "creator";

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
      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-8">
        {!email ? (
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Your studio identity</p>
              <h1 className="mt-4 font-serif text-5xl leading-[0.95] md:text-7xl">Profile</h1>
              <p className="mt-5 max-w-md text-lg text-white/65">
                Sign in to keep a collection of every mashup you fuse, delete the ones you don’t want, and get notified when generation finishes.
              </p>
            </div>
            <AuthPanel onDone={load} />
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-white/5">
              <div className="relative h-36 bg-[radial-gradient(circle_at_20%_20%,rgba(232,121,249,0.45),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(34,211,238,0.35),transparent_40%),linear-gradient(90deg,#1a1028,#0b1220)] md:h-44" />
              <div className="relative px-6 pb-8 md:px-8">
                <div className="-mt-12 flex flex-col gap-6 md:-mt-14 md:flex-row md:items-end md:justify-between">
                  <div className="flex items-end gap-4">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#07060c] bg-gradient-to-br from-fuchsia-500 to-cyan-400 font-serif text-4xl text-white shadow-[0_0_40px_rgba(168,85,247,0.45)] md:h-28 md:w-28">
                      {initial}
                    </div>
                    <div className="pb-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Inventor</p>
                      <h1 className="mt-1 font-serif text-4xl md:text-5xl">{handle}</h1>
                      <p className="mt-1 text-sm text-white/55">{email}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild variant="glow">
                      <Link href="/">
                        <Sparkles className="h-4 w-4" /> New fuse
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => signOut()}
                    >
                      Sign out
                    </Button>
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <Stat label="Mashups" value={String(items.length)} hint="Saved to this account" />
                  <Stat label="Fused today" value={String(todayCount)} hint={`UTC ${today}`} />
                  <Stat label="Gallery" value="Public" hint="Anyone can view, only you can delete" />
                </div>
              </div>
            </section>

            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <Note
                icon={<Bell className="h-4 w-4 text-amber-200" />}
                title="Browser ping"
                body="Allow notifications once. When Fuse finishes, you’ll get a desktop alert."
              />
              <Note
                icon={<Mail className="h-4 w-4 text-cyan-200" />}
                title="Ready email"
                body="If mail is configured, you’ll get a message when the image and story are live."
              />
              <Note
                icon={<Sparkles className="h-4 w-4 text-fuchsia-200" />}
                title="End-of-day recap"
                body="A UTC evening report lists every mashup you generated that day."
              />
            </section>

            <div className="mt-12 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Collection</p>
                <h2 className="mt-2 font-serif text-3xl md:text-4xl">Your mashups</h2>
              </div>
              <Link href="/gallery" className="text-sm text-white/50 underline">
                Public gallery
              </Link>
            </div>
            {error && <p className="mt-4 text-rose-300">{error}</p>}
            {loading && <p className="mt-6 text-white/50">Loading your collection…</p>}
            {!loading && items.length === 0 && (
              <div className="mt-6 rounded-[2rem] border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center">
                <p className="font-serif text-3xl">Nothing fused yet</p>
                <p className="mx-auto mt-3 max-w-md text-white/55">
                  Open the studio, pick ingredients or camera photos, and Fuse. Finished mashups land here.
                </p>
                <Button asChild variant="glow" className="mt-6">
                  <Link href="/">Start a mashup</Link>
                </Button>
              </div>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * i }}
                  className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/5"
                >
                  <Link href={`/m/${item.id}`}>
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-serif text-2xl">{item.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-white/60">{item.tagline}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/35">
                        {(item.createdAt || "").slice(0, 10) || "undated"}
                      </p>
                    </div>
                  </Link>
                  <div className="px-4 pb-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="border border-rose-400/40 text-rose-200"
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </motion.article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-white/40">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
    </div>
  );
}

function Note({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
    </div>
  );
}
