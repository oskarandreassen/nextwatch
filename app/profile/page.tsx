"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/layouts/AppShell";

type Profile = {
  userId: string;
  region: string | null;
  locale: string | null;
  dob: string | null;
  providers: string[] | null;
};
type ProfileRespOk = { ok: true; profile: Profile };
type ProfileRespErr = { ok: false; error: string };
type SaveResp = { ok: boolean; error?: string };

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [p, setP] = useState<Profile | null>(null);

  const [region, setRegion] = useState("SE");
  const [locale, setLocale] = useState("sv-SE");
  const [providers, setProviders] = useState<string>("");

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const r = await fetch("/api/profile", { cache: "no-store" });
        const j = (await r.json()) as ProfileRespOk | ProfileRespErr;
        if (ignore) return;
        if (!j.ok) throw new Error(j.error);
        setP(j.profile);
        setRegion(j.profile.region ?? "SE");
        setLocale(j.profile.locale ?? "sv-SE");
        setProviders(Array.isArray(j.profile.providers) ? j.profile.providers.join(", ") : "");
      } catch (e) {
        if (!ignore) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  async function save() {
    setErr(null);
    try {
      const body = {
        region,
        locale,
        providers: providers
          .split(",")
          .map(s => s.trim())
          .filter(Boolean),
      };
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j: SaveResp = await r.json();
      if (!j.ok) throw new Error(j.error || "Kunde inte spara.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      return;
    }
    // liten visuell kvittens
    alert("Profil uppdaterad.");
  }

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-3 text-2xl font-semibold">Profil</h1>

        {loading && <p>Laddar…</p>}
        {err && <p className="mb-3 text-red-400">{err}</p>}

        {p && (
          <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="text-sm opacity-80">
                Region
                <select
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="SE">SE – Sverige</option>
                  <option value="NO">NO – Norge</option>
                  <option value="DK">DK – Danmark</option>
                  <option value="FI">FI – Finland</option>
                  <option value="US">US – USA</option>
                  <option value="GB">GB – Storbritannien</option>
                </select>
              </label>

              <label className="text-sm opacity-80">
                Språk
                <select
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-2 py-1"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                >
                  <option value="sv-SE">sv-SE</option>
                  <option value="en-US">en-US</option>
                  <option value="nb-NO">nb-NO</option>
                  <option value="da-DK">da-DK</option>
                  <option value="fi-FI">fi-FI</option>
                </select>
              </label>
            </div>

            <label className="block text-sm opacity-80">
              Streaming­tjänster (kommaseparerade)
              <input
                className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2"
                value={providers}
                onChange={(e) => setProviders(e.target.value)}
                placeholder="Netflix, Disney Plus, Viaplay"
              />
            </label>

            <div className="text-sm opacity-80">
              Födelsedatum (läsbart): {p.dob ? new Date(p.dob).toLocaleDateString() : "—"}
            </div>

            <div className="flex gap-2">
              <button onClick={save} className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 hover:bg-white/15">
                Spara
              </button>
              <a href="/onboarding" className="rounded-lg border border-white/20 px-4 py-2 hover:bg-white/5">
                Öppna onboarding
              </a>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
