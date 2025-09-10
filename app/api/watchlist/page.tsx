"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

type Item = { tmdbId: number; mediaType: "movie" | "tv"; addedAt: string };
type Details = {
  ok: true;
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterUrl: string | null;
  posterPath: string | null;
  year: string | null;
  voteAverage: number | null;
  voteCount: number | null;
};

function fmtRating(x: number | null): string {
  if (x == null) return "–";
  return `${(Math.round(x * 10) / 10).toFixed(1)}`;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [details, setDetails] = useState<Record<string, Details>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const r = await fetch("/api/watchlist/list", { cache: "no-store" });
        const j = await r.json();
        if (!j?.ok) { setErr(j?.error || "Fel"); return; }
        if (!ignore) setItems(j.items as Item[]);
      } catch (e) {
        if (!ignore) setErr(String(e));
      }
    })();
    return () => { ignore = true; };
  }, []);

  // Hämta detaljer för de första 24 posterna (lagom för initial view)
  useEffect(() => {
    let stop = false;
    (async () => {
      const first = items.slice(0, 24);
      for (const it of first) {
        const key = `${it.mediaType}:${it.tmdbId}`;
        if (details[key]) continue;
        try {
          const r = await fetch(`/api/tmdb/details?type=${it.mediaType}&id=${it.tmdbId}`, { cache: "force-cache" });
          const js = (await r.json()) as Details;
          if (!stop && js?.ok) {
            setDetails(prev => ({ ...prev, [`${js.mediaType}:${js.id}`]: js }));
          }
        } catch { /* ignore */ }
      }
    })();
    return () => { stop = true; };
  }, [items, details]);

  if (err) return <main className="max-w-5xl mx-auto p-6 text-red-500">{err}</main>;

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Watchlist</h1>
      {items.length === 0 ? (
        <div className="opacity-80">Inget sparat ännu.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {items.map((it) => {
            const d = details[`${it.mediaType}:${it.tmdbId}`];
            return (
              <div key={`${it.mediaType}:${it.tmdbId}`} className="relative rounded-xl overflow-hidden border shadow" style={{ aspectRatio: "2 / 3" }}>
                {d?.posterPath ? (
                  <>
                    <Image
                      src={`https://image.tmdb.org/t/p/w500${d.posterPath}`}
                      alt={d.title}
                      fill
                      sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 50vw"
                      className="object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent text-white">
                      <div className="text-sm font-semibold truncate">{d.title}</div>
                      <div className="text-xs opacity-90 flex items-center gap-2">
                        <span>{d.year ?? "—"}</span>
                        <span className="ml-auto">★ {fmtRating(d.voteAverage)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs opacity-70">Ingen poster</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
