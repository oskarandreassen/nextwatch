"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LandingPage() {
  const r = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    try {
      setBusy(true);
      setErr(null);
      const res = await fetch("/api/session/init", { method: "POST" });
      if (!res.ok) throw new Error("Kunde inte initiera session.");
      r.push("/onboarding");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-black text-white">
      <div className="mx-auto max-w-3xl p-6">
        <header className="py-6">
          <div className="text-xl font-semibold">nextwatch</div>
        </header>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold leading-tight">Hitta något att se – snabbare.</h1>
            <p className="mt-4 text-white/80">
              Svep igenom smarta rekommendationer baserat på dina streamingtjänster.
              Skapa en grupp och få träff när ni alla gillar samma titel.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={start}
                disabled={busy}
                className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 hover:bg-white/15 disabled:opacity-60"
              >
                {busy ? "Startar…" : "Kom igång gratis"}
              </button>
              <a href="/swipe" className="rounded-xl border border-white/20 px-5 py-3 hover:bg-white/5">
                Hoppa direkt till svep
              </a>
            </div>
            {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <ul className="space-y-3 text-sm text-white/90">
              <li>✔ Personliga förslag (region/ålder/provider)</li>
              <li>✔ Grupp-swipe med auto-match</li>
              <li>✔ Watchlist</li>
              <li>✔ Premium: inga annonser och större grupper</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
