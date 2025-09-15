// app/components/auth/InlineLogin.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function InlineLogin() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      // TODO: din faktiska login endpoint här
      // const res = await fetch("/api/auth/login", { ... })
      // if (!res.ok) throw new Error("Fel e-post eller lösenord.");
      // router.replace("/swipe");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ett fel uppstod.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 shadow-xl">
      <h2 className="mb-4 text-center text-2xl font-semibold">Logga in</h2>
      {err && (
        <div className="mb-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {err}
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-sm text-white/70">E-post</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 p-3 outline-none focus:ring-2 focus:ring-white/20"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="du@exempel.se"
            required
          />
        </div>
        <div>
          <label className="text-sm text-white/70">Lösenord</label>
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 p-3 outline-none focus:ring-2 focus:ring-white/20"
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-cyan-500 py-3 font-medium text-black hover:bg-cyan-400 disabled:opacity-50"
        >
          {loading ? "Loggar in…" : "Logga in"}
        </button>
      </form>

      {/* Endast EN länk nedan */}
      <div className="mt-6 text-center text-sm text-white/70">
        Ny användare?{" "}
        <Link href="/onboarding" className="underline">
          Skapa konto
        </Link>
      </div>
    </div>
  );
}
