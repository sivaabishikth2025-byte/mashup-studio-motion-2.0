"use client";

import { LoginView } from "@/components/login-view";
import { clearSession } from "@/lib/auth";
import { useEffect } from "react";

export default function LoginPage() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("out")) {
      clearSession();
    }
  }, []);

  return (
    <LoginView
      onDone={() => {
        window.location.replace("/");
      }}
    />
  );
}
