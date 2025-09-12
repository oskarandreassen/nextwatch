// app/watchlist/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type WatchItem = {
  id: string;
  type: "movie" | "tv";
  title: string;
  year?: number | null;
  rating?: number | null;
  poster?: string | null;
};

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/watchlist/list", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // Anta att API:t returnerar { ok: true, items: WatchItem[] }
        const list = Array.isArray(data?.items) ? (data.items as WatchItem[]) : [];
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message || "Failed to load watchlist");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const total = useMemo(() => items.length, [items]);

  return (
    <main className="mx-auto w-full max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Watchlist</h1>
      <p className="mt-2 text-sm text-neutral-500">Saved movies and shows.</p>

      {loading && <div className="mt-6 text-sm text-neutral-500">Loading…</div>}
      {err && !loading && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}

      {!loading && !err && (
        <>
          <div className="mt-4 text-sm text-neutral-600">{total} items</div>

          <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((it) => (
              <article key={`${it.type}-${it.id}`} className="group relative overflow-hidden rounded-md border border-neutral-200">
                {it.poster ? (
                  <Image
                    src={it.poster}
                    alt={it.title}
                    width={342}
                    height={513}
                    className="h-auto w-full"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
                    priority={false}
                  />
                ) : (
                  <div className="flex aspect-[2/3] w-full items-center justify-center bg-neutral-100 text-neutral-500">
                    No poster
                  </div>
                )}
                <div className="p-2">
                  <div className="line-clamp-1 text-sm font-medium">{it.title}</div>
                  <div className="text-xs text-neutral-500">
                    {it.year ?? "—"} {typeof it.rating === "number" ? ` • ★ ${it.rating.toFixed(1)}` : ""}
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
