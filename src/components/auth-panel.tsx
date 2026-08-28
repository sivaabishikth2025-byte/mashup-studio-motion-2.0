"use client";

import { confirmSignUp, signIn, signUp } from "@/lib/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function AuthPanel({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup" | "confirm">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signUp(email, password);
        setMode("confirm");
      } else if (mode === "confirm") {
        await confirmSignUp(email, code);
        await signIn(email, password);
        onDone();
      } else {
        await signIn(email, password);
        onDone();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/50 p-6 backdrop-blur-xl">
      <h2 className="font-serif text-3xl">
        {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Confirm email"}
      </h2>
      <p className="mt-2 text-sm text-white/55">
        Fuse still generates a full illustration first. Video and score are extra layers on top of that still.
      </p>
      <p className="mt-2 text-sm text-white/55">
        Save fusions, delete your gallery posts, and get email when a mashup is ready.
      </p>
      <div className="mt-5 grid gap-3">
        <input
          className="h-11 rounded-full border border-white/10 bg-white/5 px-4"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {mode !== "confirm" && (
          <input
            className="h-11 rounded-full border border-white/10 bg-white/5 px-4"
            placeholder="Password (8+ characters)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {mode === "confirm" && (
          <input
            className="h-11 rounded-full border border-white/10 bg-white/5 px-4"
            placeholder="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <Button variant="glow" disabled={busy} onClick={submit}>
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Confirm"}
        </Button>
      </div>
      <div className="mt-4 text-sm text-white/50">
        {mode === "signin" ? (
          <button className="underline" onClick={() => setMode("signup")}>
            Need an account? Sign up
          </button>
        ) : (
          <button className="underline" onClick={() => setMode("signin")}>
            Already have an account? Sign in
          </button>
        )}
      </div>
    </div>
  );
}
