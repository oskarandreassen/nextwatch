"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

export default function SwipePage() {
  return (
    <Suspense fallback={<div className="p-6">Laddar…</div>}>
      <SwipeInner />
    </Suspense>
  );
}

type RecItem = {
  type: "rec";
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  matchedProviders: string[];
  unknown: boolean;
};
type AdItem = { type: "ad"; id: string; headline: string; body: string; cta: string; href: string };
type FeedItem = RecItem | AdItem;

type Details = {
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
type ApiDetailsOk = Details & { ok: true };
type ApiDetailsErr = { ok: false; error: string };

function isRec(x: FeedItem | undefined): x is RecItem {
  return !!x && x.type === "rec";
}
function fmtRating(v: number | null): string {
  if (v == null) return "–";
  return (Math.round(v * 10) / 10).toFixed(1);
}

function SwipeInner() {
  const sp = useSearchParams();
  const media = (sp?.get("media") || "both") as "movie" | "tv" | "both";

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [err, setErr] = useState("");

  const [detailsMap, setDetailsMap] = useState<Record<string, Details>>({});

  const feedRef = useRef<FeedItem[]>([]);
  const indexRef = useRef(0);
  const detailsRef = useRef<Record<string, Details>>({});

  useEffect(() => { feedRef.current = feed; }, [feed]);
  useEffect(() => { indexRef.current = i; }, [i]);
  useEffect(() => { detailsRef.current = detailsMap; }, [detailsMap]);

  // Ladda feed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/recs/personal?media=${media}&limit=40`, { cache: "no-store" });
        const js = await r.json();
        if (cancelled) return;
        if (js?.ok) {
          setFeed(js.feed as FeedItem[]);
          setI(0);
          setFlip(false);
          setErr("");
        } else setErr(js?.error || "Fel");
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [media]);

  // Hämta details (valbar cache-policy)
  const fetchDetails = useCallback(async (type: "movie" | "tv", id: number, cache: RequestCache) => {
    const key = `${type}:${id}`;
    if (detailsRef.current[key]) return;
    try {
      const r = await fetch(`/api/tmdb/details?type=${type}&id=${id}`, { cache });
      const js = (await r.json()) as ApiDetailsOk | ApiDetailsErr;
      if (!js.ok) return;
      setDetailsMap(prev => ({ ...prev, [`${js.mediaType}:${js.id}`]: js }));
    } catch { /* ignore */ }
  }, []);

  // Prefetch: aktuell (no-store på första) + nästa
  useEffect(() => {
    const cur = feed[i];
    if (isRec(cur)) fetchDetails(cur.mediaType, cur.tmdbId, i === 0 ? "no-store" : "force-cache");
    const nxt = feed[i + 1];
    if (isRec(nxt)) fetchDetails(nxt.mediaType, nxt.tmdbId, "force-cache");
  }, [feed, i, fetchDetails]);

  // Drag/tap
  const cardWrapRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number | null>(null);
  const startT = useRef<number>(0);

  const resetCardTransform = useCallback(() => {
    if (cardWrapRef.current) {
      cardWrapRef.current.style.transition = "transform 180ms ease-out";
      cardWrapRef.current.style.transform = "";
    }
  }, []);

  const decide = useCallback(async (kind: "like" | "dislike" | "skip" | "seen") => {
    resetCardTransform(); // nollställ position direkt
    const idx = indexRef.current;
    const item = feedRef.current[idx];
    if (!item || item.type === "ad") {
      setI(v => v + 1);
      setFlip(false);
      return;
    }
    try {
      await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType, decision: kind }),
      });
    } catch { /* ignore */ }
    finally {
      setI(v => v + 1);
      setFlip(false);
    }
  }, [resetCardTransform]);

  const toggleWatch = useCallback(async () => {
    const idx = indexRef.current;
    const item = feedRef.current[idx];
    if (!isRec(item)) return;
    try {
      await fetch("/api/watchlist/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType, add: true }),
      });
    } catch { /* ignore */ }
  }, []);

  // Tangentbord
  const handleKey = useCallback((e: KeyboardEvent) => {
    const idx = indexRef.current;
    const item = feedRef.current[idx];
    if (!item || item.type === "ad") {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        setI(v => v + 1); setFlip(false);
      }
      return;
    }
    if (e.key === "ArrowLeft") decide("dislike");
    else if (e.key === "ArrowRight") decide("like");
    else if (e.key === "ArrowUp") toggleWatch();
    else if (e.key === " ") setFlip(f => !f);
  }, [decide, toggleWatch]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  // Pointer events
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX; startT.current = e.timeStamp;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (cardWrapRef.current) cardWrapRef.current.style.transition = "transform 0s";
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (startX.current == null || !cardWrapRef.current) return;
    const dx = e.clientX - startX.current;
    cardWrapRef.current.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
  }, []);
  const onPointerEnd = useCallback((e: React.PointerEvent) => {
    const sx = startX.current; startX.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (sx == null) return;
    const dx = e.clientX - sx; const dt = e.timeStamp - startT.current;
    const isTap = Math.abs(dx) < 10 && dt < 300;
    if (isTap) { setFlip(f => !f); resetCardTransform(); return; }
    if (dx > 120) { decide("like"); return; }
    if (dx < -120) { decide("dislike"); return; }
    resetCardTransform();
  }, [decide, resetCardTransform]);

  const cur = feed[i];
  if (err) return <div className="p-6 text-red-500">{err}</div>;
  if (!cur) return <div className="p-6">Slut på förslag för nu.</div>;

  const dKey = isRec(cur) ? `${cur.mediaType}:${cur.tmdbId}` : "";
  const det = isRec(cur) ? detailsMap[dKey] : undefined;

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Dina förslag</h1>

      {cur.type === "ad" ? (
        <div className="border rounded-xl p-5 mb-4">
          <div className="text-xs opacity-60 mb-1">Annons</div>
          <div className="font-semibold">{cur.headline}</div>
          <div className="text-sm opacity-80">{cur.body}</div>
          <a className="underline text-sm" href={cur.href}>{cur.cta}</a>
          <div className="mt-4"><button className="border rounded px-3 py-1 mr-2" onClick={() => setI(v => v + 1)}>Fortsätt</button></div>
        </div>
      ) : (
        <>
          {/* Flip: front = poster (med overlay), back = info */}
          <div
            className="[perspective:1000px] select-none cursor-grab active:cursor-grabbing"
            style={{ touchAction: "pan-y" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <div
              ref={cardWrapRef}
              className="relative w-full overflow-hidden rounded-xl border shadow"
              style={{ aspectRatio: "2 / 3" }}
            >
              <div className={`absolute inset-0 transition-transform duration-300 [transform-style:preserve-3d] ${flip ? "[transform:rotateY(180deg)]" : ""}`}>
                {/* FRONT */}
                <div className="absolute inset-0 [backface-visibility:hidden]">
                  {det?.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w780${det.posterPath}`}
                      alt={det.title}
                      fill
                      sizes="(min-width: 768px) 640px, 100vw"
                      className="object-cover"
                      priority={i === 0}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_25%,rgba(255,255,255,0.12)_37%,rgba(255,255,255,0.06)_63%)] bg-[length:400%_100%] animate-[shimmer_1.2s_infinite] rounded-xl" />
                  )}

                  {/* ALWAYS-ON OVERLAY (ligger över bilden, stör inte drag/tap) */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent text-white">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold truncate">{det?.title ?? cur.title}</div>
                        <div className="text-xs opacity-90">{det?.year ?? "—"}</div>
                      </div>
                      <div className="text-sm font-medium shrink-0">
                        ★ {fmtRating(det?.voteAverage ?? null)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* BACK: info */}
                <div className="absolute inset-0 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-black/55 text-white">
                  <div className="text-lg font-semibold mb-1">
                    {det?.title || cur.title} {det?.year ? <span className="text-xs opacity-70">[{det.year}]</span> : null}
                  </div>
                  <div className="text-sm opacity-80 mb-2">
                    Providers: {cur.matchedProviders.join(", ") || (cur.unknown ? "Okänd" : "—")}
                  </div>
                  <p className="text-sm opacity-90">{det ? det.overview || "Ingen beskrivning." : "Laddar info…"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Knappar */}
          <div className="mt-3 flex justify-center gap-3">
            <button className="border rounded px-4 py-2" onClick={() => decide("dislike")}>Nej ←</button>
            <button className="border rounded px-4 py-2" onClick={() => setFlip(f => !f)}>Info</button>
            <button className="border rounded px-4 py-2" onClick={() => decide("like")}>Ja →</button>
            <button className="border rounded px-4 py-2" onClick={toggleWatch}>+ Watchlist ↑</button>
          </div>
        </>
      )}

      <div className="mt-4 text-sm opacity-70">
        Tips: Tryck/tap på kortet för att vända. ←/→ Nej/Ja, ↑ Watchlist, Space vänd.
      </div>

      <style jsx>{`@keyframes shimmer { 0% { background-position: 100% 0 } 100% { background-position: 0 0 } }`}</style>
    </div>
  );
}
