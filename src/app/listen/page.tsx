"use client";

import { Header } from "@/components/header";
import { Particles } from "@/components/particles";

const STYLES = [
  { id: "cinematic", label: "Cinematic" },
  { id: "playful", label: "Playful" },
  { id: "ominous", label: "Ominous" },
];

export default function ListenPage() {
  return (
    <div className="relative min-h-screen">
      <Particles />
      <Header guest />
      <main className="relative mx-auto max-w-3xl px-4 pb-24 pt-10">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Preview</p>
        <h1 className="mt-3 font-serif text-5xl">Original AI scores</h1>
        <p className="mt-4 max-w-xl text-white/65">
          These cues are synthesized for Mashup Studio Motion. Nova picks key and tempo
          from the invention; a synth renders a unique WAV. No licensed tracks.
        </p>
        <div className="mt-10 grid gap-4">
          {STYLES.map((style) => (
            <div
              key={style.id}
              className="rounded-3xl border border-white/10 bg-white/5 p-5"
            >
              <p className="text-sm uppercase tracking-[0.2em] text-fuchsia-300">
                {style.label}
              </p>
              <audio className="mt-4 w-full" controls src={`/preview-${style.id}.wav`} />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
