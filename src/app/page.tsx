"use client";

import { LoginView } from "@/components/login-view";
import { Studio } from "@/components/studio";
import { clearSession, getSession } from "@/lib/auth";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("out")) {
      clearSession();
      window.history.replaceState({}, "", "/");
    }
    setAuthed(Boolean(getSession()?.accessToken));
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-[#07060c]" />;
  }

  if (!authed) {
    return (
      <LoginView
        onDone={() => {
          window.location.replace("/");
        }}
      />
    );
  }

  return <Studio />;
}
