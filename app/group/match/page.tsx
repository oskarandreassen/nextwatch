"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function GroupMatchPage() {
  return (
    <Suspense fallback={<div className="p-6">Laddar…</div>}>
      <GroupMatchInner />
    </Suspense>
  );
}

type MatchItem = { tmdbId:number; mediaType:"movie"|"tv"; likes:number };

function GroupMatchInner() {
  const sp = useSearchParams();
  const code = sp?.get("code") || "";
  const [data, setData] = useState<{ need:number; size:number; matches:MatchItem[] }|null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!code) return;
    fetch(`/api/group/match?code=${encodeURIComponent(code)}`)
      .then(r=>r.json()).then(js=> js.ok ? setData(js) : setErr(js.error||"Fel"))
      .catch(e=>setErr(String(e)));
  }, [code]);

  if (!code) return <div className="p-6">Ingen kod. Gå till <a className="underline" href="/group">/group</a>.</div>;
  if (err) return <div className="p-6 text-red-500">{err}</div>;
  if (!data) return <div className="p-6">Laddar…</div>;
  if (!data.matches.length) return <div className="p-6">Inga träffar ännu. Fortsätt svepa!</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-bold">Gruppens träffar</h1>
      <div className="text-sm opacity-70">Gruppstorlek: {data.size}. Kräver minst {data.need} likes och 0 dislikes.</div>
      {data.matches.map((m, idx)=>(
        <div key={`${m.tmdbId}-${m.mediaType}-${idx}`} className="border rounded p-3 flex items-center justify-between">
          <div>
            <div className="font-medium">TMDb #{m.tmdbId} <span className="text-xs opacity-60">({m.mediaType})</span></div>
            <div className="text-sm opacity-70">Likes: {m.likes}</div>
          </div>
          <a className="underline text-sm" href={`https://www.themoviedb.org/${m.mediaType}/${m.tmdbId}`} target="_blank">Öppna på TMDb</a>
        </div>
      ))}
    </div>
  );
}
