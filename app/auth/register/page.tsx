"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Ett fel uppstod.");
      }
      setOk("Klart! Kolla din e-post för verifikation.");
      // vidare till appen – ändra till /auth/verify om du bygger verify-sida
      setTimeout(() => router.replace("/swipe"), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ett fel uppstod.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">Skapa inloggning</h1>
        <p className="text-sm text-white/60 mb-4">
          Ange e-post och välj ett lösenord för att slutföra kontot.
        </p>

        {error && (
          <div className="mb-3 rounded-lg bg-red-500/10 text-red-400 px-3 py-2 text-sm">
            {error}
          </div>
        )}
        {ok && (
          <div className="mb-3 rounded-lg bg-emerald-500/10 text-emerald-400 px-3 py-2 text-sm">
            {ok}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-sm text-white/70">E-post</label>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none focus:ring-2 focus:ring-white/20"
              placeholder="du@exempel.se"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="text-sm text-white/70">Lösenord</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 p-3 outline-none focus:ring-2 focus:ring-white/20"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="mt-1 text-xs text-white/40">Minst 8 tecken.</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-2xl bg-white/15 py-3 font-medium hover:bg-white/25 disabled:opacity-50"
          >
            {loading ? "Sparar…" : "Fortsätt"}
          </button>
        </form>
      </div>
    </div>
  );
}
