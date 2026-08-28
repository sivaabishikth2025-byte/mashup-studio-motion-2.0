"use client";

import { AuthPanel } from "@/components/auth-panel";
import { Header } from "@/components/header";
import { Particles } from "@/components/particles";

export function LoginView({ onDone }: { onDone: () => void }) {
  return (
    <div className="relative min-h-screen">
      <Particles />
      <Header guest />
      <main className="relative mx-auto flex max-w-6xl justify-center px-4 pb-20 pt-10">
        <AuthPanel onDone={onDone} />
      </main>
    </div>
  );
}
