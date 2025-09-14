"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Ett fel uppstod.");

      setMsg(
        "Klart! Kolla din mejl för verifikation (eller använd devToken i svar tills e-post är på plats)."
      );

      // Efter registrering kan vi gå till /swipe (eller visa separat verify-sida)
      setTimeout(() => router.replace("/swipe"), 800);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Ett fel uppstod.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold mb-4">Skapa inloggning</h1>
      {err && <div className="mb-3 rounded bg-red-500/10 text-red-600 p-3 text-sm">{err}</div>}
      {msg && <div className="mb-3 rounded bg-emerald-500/10 text-emerald-400 p-3 text-sm">{msg}</div>}
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-sm">E-post</span>
          <input
            type="email"
            className="mt-1 w-full rounded border bg-transparent p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@exempel.se"
            required
          />
        </label>

        <label className="block">
          <span className="text-sm">Lösenord</span>
          <input
            type="password"
            className="mt-1 w-full rounded border bg-transparent p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded bg-white/10 py-2 hover:bg-white/20 disabled:opacity-50"
        >
          {loading ? "Skapar…" : "Fortsätt"}
        </button>
      </form>
    </div>
  );
}
