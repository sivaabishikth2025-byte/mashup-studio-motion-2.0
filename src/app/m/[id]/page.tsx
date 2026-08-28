import { Header } from "@/components/header";
import { Particles } from "@/components/particles";
import { ResultView } from "@/components/result-view";
import { fuseApiUrl, overlayMotionFields } from "@/lib/api";
import type { Mashup } from "@/lib/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function loadMashup(id: string): Promise<Mashup | null> {
  const res = await fetch(`${fuseApiUrl()}/mashups/${id}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  const mashup = (await res.json()) as Mashup;
  return overlayMotionFields(id, mashup);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const mashup = await loadMashup(id);
  if (!mashup) return { title: "Mashup" };
  return {
    title: `${mashup.name} · Infinite Mashup Motion`,
    description: mashup.tagline,
    openGraph: {
      title: mashup.name,
      description: mashup.tagline,
      images: mashup.imageUrl ? [{ url: mashup.imageUrl }] : [],
    },
  };
}

export default async function MashupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mashup = await loadMashup(id);
  if (!mashup) notFound();
  return (
    <div className="relative min-h-screen">
      <Particles />
      <Header />
      <ResultView mashup={mashup} />
    </div>
  );
}
