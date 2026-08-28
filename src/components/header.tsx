"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getSession, signOut } from "@/lib/auth";
import { useEffect, useState } from "react";

export function Header({ guest = false }: { guest?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (guest) return;
    setEmail(getSession()?.email || null);
  }, [guest]);

  return (
    <header className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
      <Link href={guest ? "/" : "/"} className="flex items-center gap-2 font-medium">
        <Sparkles className="h-4 w-4 text-fuchsia-300" />
        Infinite Mashup Motion
      </Link>
      <nav className="flex items-center gap-5 text-sm text-white/70">
        <Link href="/listen" className="hover:text-white">
          AI scores
        </Link>
        {!guest && email && (
          <>
            <Link href="/" className="hover:text-white">
              Studio
            </Link>
            <Link href="/gallery" className="hover:text-white">
              Gallery
            </Link>
            <Link href="/profile" className="hover:text-white">
              Profile
            </Link>
            <Link
              href="/?out=1"
              className="hover:text-white"
              onClick={(e) => {
                e.preventDefault();
                signOut();
              }}
            >
              Sign out
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
