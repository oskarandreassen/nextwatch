// app/watchlist/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type WatchItem = { id: string; type: "movie"|"tv"; title: string; year?: number|null; rating?: number|null; poster?: string|null };
const posterUrl = (p?: string|null) => (!p ? null : p.startsWith("http") ? p : `https://image.tmdb.org/t/p/w342${p}`);

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/watchlist/list", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const list = Array.isArray(data?.items) ? (data.items as WatchItem[]) : [];
        if (!off) setItems(list);
      } catch (e) {
        if (!off) setErr((e as Error).message);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, []);

  const total = useMemo(() => items.length, [items]);

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Watchlist</h1>
      <p className="mt-2 text-sm text-neutral-400">Saved movies and shows.</p>

      {loading && <div className="mt-6 text-sm text-neutral-500">Loading…</div>}
      {err && !loading && <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{err}</div>}

      {!loading && !err && (
        <>
          <div className="mt-4 text-sm text-neutral-400">{total} items</div>
          <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((it) => {
              const url = posterUrl(it.poster);
              return (
                <article key={`${it.type}-${it.id}`} className="group relative overflow-hidden rounded-md border border-neutral-800 bg-neutral-900">
                  {url ? (
                    <Image src={url} alt={it.title} width={342} height={513} className="h-auto w-full"
                           sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw" />
                  ) : (
                    <div className="flex aspect-[2/3] w-full items-center justify-center bg-neutral-800 text-neutral-400">No poster</div>
                  )}
                  <div className="p-2">
                    <div className="line-clamp-1 text-sm font-medium text-white">{it.title}</div>
                    <div className="text-xs text-neutral-400">{it.year ?? "—"}{typeof it.rating==="number" ? ` • ★ ${it.rating.toFixed(1)}` : ""}</div>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
