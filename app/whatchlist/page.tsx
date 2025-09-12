"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/layouts/AppShell";
import Image from "next/image";

type WLRow = { tmdbId: number; mediaType: "movie" | "tv"; addedAt?: string | null };
type ListOk = { ok: true; items: WLRow[] };
type ListErr = { ok: false; error: string };

type Details = {
  ok: true;
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterPath: string | null;
  year: string | null;
  voteAverage: number | null;
  blurDataURL: string | null;
};

function fmtRating(v: number | null) {
  if (v == null) return "–";
  return (Math.round(v * 10) / 10).toFixed(1);
}

export default function WatchlistPage() {
  const [rows, setRows] = useState<WLRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Details>>({});

  useEffect(() => {
    let ignore = false;
    (async () => {
      setBusy(true); setErr(null);
      try {
        const r = await fetch("/api/watchlist/list", { cache: "no-store" });
        const j = (await r.json()) as ListOk | ListErr;
        if (ignore) return;
        if (!j.ok) throw new Error(j.error);
        // sortera nyast överst om timestamp finns
        const sorted = [...j.items].sort((a, b) => {
          const ta = a.addedAt ? new Date(a.addedAt).getTime() : 0;
          const tb = b.addedAt ? new Date(b.addedAt).getTime() : 0;
          return tb - ta;
        });
        setRows(sorted);
        // prefetch upp till 12 details
        const head = sorted.slice(0, 12);
        await Promise.all(head.map(async (it) => {
          const key = `${it.mediaType}:${it.tmdbId}`;
          if (details[key]) return;
          const rr = await fetch(`/api/tmdb/details?type=${it.mediaType}&id=${it.tmdbId}`, { cache: "no-store" });
          const jj = (await rr.json()) as Details | { ok: false };
          if ((jj as Details).ok) {
            setDetails((prev) => ({ ...prev, [key]: jj as Details }));
          }
        }));
      } catch (e) {
        if (!ignore) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ignore) setBusy(false);
      }
    })();
    return () => { ignore = true; };
  }, []);

  async function remove(it: WLRow) {
    await fetch("/api/watchlist/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tmdbId: it.tmdbId, mediaType: it.mediaType, add: false }),
    });
    setRows((prev) => prev.filter((r) => !(r.tmdbId === it.tmdbId && r.mediaType === it.mediaType)));
  }

  async function markSeen(it: WLRow) {
    await fetch("/api/rate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tmdbId: it.tmdbId, mediaType: it.mediaType, decision: "seen" }),
    });
    setRows((prev) => prev.filter((r) => !(r.tmdbId === it.tmdbId && r.mediaType === it.mediaType)));
  }

  const cards = useMemo(() => rows.map((it) => {
    const key = `${it.mediaType}:${it.tmdbId}`;
    const d = details[key];
    return (
      <div key={key} className="group relative overflow-hidden rounded-xl border">
        {d?.posterPath ? (
          <Image
            src={`https://image.tmdb.org/t/p/w342${d.posterPath}`}
            alt={d.title}
            width={342}
            height={513}
            className="h-auto w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            placeholder={d.blurDataURL ? "blur" : undefined}
            blurDataURL={d.blurDataURL || undefined}
          />
        ) : (
          <div className="aspect-[2/3] bg-white/5" />
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 text-[12px]">
          <div className="truncate font-medium">{d?.title ?? `${it.mediaType} #${it.tmdbId}`}</div>
          <div className="flex items-center justify-between opacity-90">
            <span>{d?.year ?? "—"}</span>
            <span>★ {fmtRating(d?.voteAverage ?? null)}</span>
          </div>
        </div>

        <div className="absolute inset-x-0 top-0 flex gap-2 p-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            onClick={() => markSeen(it)}
            className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs hover:bg-white/15"
          >
            Markera sedd
          </button>
          <button
            onClick={() => remove(it)}
            className="rounded-md border border-red-400/40 bg-red-500/15 px-2 py-1 text-xs hover:bg-red-500/25"
          >
            Ta bort
          </button>
        </div>
      </div>
    );
  }), [rows, details]);

  return (
    <AppShell>
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="mb-3 text-2xl font-semibold">Watchlist</h1>
        {busy && <div className="mb-3 opacity-80">Laddar…</div>}
        {err && <div className="mb-3 text-red-400">{err}</div>}
        {rows.length === 0 && !busy ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
            Din watchlist är tom. Börja swipa i <a className="underline" href="/swipe">Recommendations</a>.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {cards}
          </div>
        )}
      </main>
    </AppShell>
  );
}
