"use client";

import { useEffect, useState } from "react";

type Rec = { tmdbId:number; mediaType:"movie"|"tv"; title:string; matchedProviders:string[]; unknown:boolean };

export default function RecsTestPage() {
  const [data, setData] = useState<{ results: Rec[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/recs/smart?media=both&limit=30")
      .then(r => r.json())
      .then(js => { if (js.ok) setData(js); else setErr(js.error || "Fel"); })
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Laddar...</div>;
  if (err) return <div className="p-6 text-red-400">Fel: {err}</div>;
  if (!data?.results?.length) return <div className="p-6">Inga resultat. Har du sparat profil på <a className="underline" href="/onboarding">/onboarding</a>?</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Rekommendationer (smart)</h1>
      <ul className="space-y-2">
        {data.results.map(r => (
          <li key={`${r.mediaType}:${r.tmdbId}`} className="border rounded-md p-3">
            <div className="font-medium">{r.title} <span className="text-xs opacity-60">({r.mediaType})</span></div>
            <div className="text-sm opacity-80">Providers: {r.matchedProviders.join(", ") || (r.unknown ? "Okänd" : "—")}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
