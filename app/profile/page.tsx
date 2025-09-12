// app/profile/page.tsx
"use client";

import { useEffect, useState } from "react";

type Profile = {
  userId: string;
  region: string;
  locale: string;
  uiLanguage: string;
  providers: unknown;
  dob: string;
  yearPreference: string;
  recycleAfterDays: number;
  displayName: string | null;
};

export default function ProfilePage() {
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/profile", { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setP(data.profile as Profile);
    })();
  }, []);

  if (!p) return <main className="mx-auto max-w-3xl p-6">Laddar…</main>;

  const save = async () => {
    setSaving(true); setMsg(null);
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
    const data = await res.json();
    setSaving(false);
    setMsg(data?.ok ? "Sparat!" : data?.error || "Kunde inte spara");
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Profil</h1>

      <div className="mt-4 space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-neutral-300">Region</label>
            <select
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2"
              value={p.region}
              onChange={(e) => setP({ ...p, region: e.target.value })}
            >
              <option value="SE">SE – Sverige</option>
              <option value="NO">NO – Norge</option>
              <option value="DK">DK – Danmark</option>
              <option value="FI">FI – Finland</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-neutral-300">Språk</label>
            <select
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2"
              value={p.locale}
              onChange={(e) => setP({ ...p, locale: e.target.value })}
            >
              <option value="sv-SE">sv-SE</option>
              <option value="en-US">en-US</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-neutral-300">Visningsnamn (för grupper)</label>
          <input
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2"
            placeholder="Ex: Oskar"
            value={p.displayName ?? ""}
            onChange={(e) => setP({ ...p, displayName: e.target.value })}
          />
        </div>

        <div>
          <label className="text-sm text-neutral-300">Streaming­tjänster (komma­separerade)</label>
          <input
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2"
            placeholder="Netflix, HBO Max"
            value={Array.isArray(p.providers) ? (p.providers as string[]).join(", ") : String(p.providers ?? "")}
            onChange={(e) => setP({ ...p, providers: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
          />
        </div>

        <div>
          <label className="text-sm text-neutral-300">Födelsedatum</label>
          <input
            type="date"
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2"
            value={p.dob?.slice(0, 10) ?? ""}
            onChange={(e) => setP({ ...p, dob: e.target.value })}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-60"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Sparar…" : "Spara"}
          </button>
          {msg && <div className="text-sm text-neutral-300">{msg}</div>}
          <a
            href="/onboarding"
            className="ml-auto rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
          >
            Öppna onboarding
          </a>
        </div>
      </div>
    </main>
  );
}
