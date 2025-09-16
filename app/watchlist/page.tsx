// app/watchlist/page.tsx
"use client";

import { useEffect, useState } from "react";

type Card = {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string | null;
  poster: string | null;
  rating?: number | null;
};

type ApiRes = { ok: boolean; items: Card[]; message?: string };

export default function WatchlistPage() {
  const [items, setItems] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/watchlist/list", { cache: "no-store" });
        const data = (await res.json()) as ApiRes;
        if (data.ok) setItems(data.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="p-4">
      <h1 className="mb-2 text-2xl font-semibold">Watchlist</h1>
      {loading ? (
        <div>Laddar…</div>
      ) : items.length === 0 ? (
        <div className="opacity-70">Inget sparat än.</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 overflow-hidden">
              <div className="relative aspect-[2/3] bg-neutral-900">
                {c.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.poster} alt={c.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm opacity-70">No poster</div>
                )}
                {typeof c.rating === "number" ? (
                  <div className="absolute bottom-1 right-1 rounded bg-black/70 px-2 py-0.5 text-xs font-semibold text-yellow-300">
                    ★ {c.rating.toFixed(1)}
                  </div>
                ) : null}
              </div>
              <div className="px-2 py-2">
                <div className="truncate text-sm font-medium">{c.title}</div>
                <div className="text-xs opacity-70">
                  {c.mediaType.toUpperCase()} {c.year ? `• ${c.year}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
