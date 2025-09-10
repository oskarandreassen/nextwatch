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
type AdItem = {
  type: "ad";
  id: string;
  headline: string;
  body: string;
  cta: string;
  href: string;
};
type FeedItem = RecItem | AdItem;

type Details = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterUrl: string | null;   // back-compat (w500)
  posterPath: string | null;  // används för w780 (skarpare)
  year: string | null;
};
type ApiDetailsOk = Details & { ok: true };
type ApiDetailsErr = { ok: false; error: string };

function isRec(x: FeedItem | undefined): x is RecItem {
  return !!x && x.type === "rec";
}

function SwipeInner() {
  const sp = useSearchParams();
  const media = (sp?.get("media") || "both") as "movie" | "tv" | "both";

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [err, setErr] = useState("");

  // detaljer-cache
  const [detailsMap, setDetailsMap] = useState<Record<string, Details>>({});

  // Refs → stabila callbacks utan deps-varningar
  const feedRef = useRef<FeedItem[]>([]);
  const indexRef = useRef(0);
  const detailsRef = useRef<Record<string, Details>>({});

  useEffect(() => { feedRef.current = feed; }, [feed]);
  useEffect(() => { indexRef.current = i; }, [i]);
  useEffect(() => { detailsRef.current = detailsMap; }, [detailsMap]);

  // Hämta feed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/recs/personal?media=${media}&limit=40`, { cache: "no-store" });
        const js = await r.json();
        if (cancelled) return;
        if (js?.ok) {
          const f = js.feed as FeedItem[];
          setFeed(f);
          setI(0);
          setFlip(false);
          setErr("");
        } else {
          setErr(js?.error || "Fel");
        }
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [media]);

  // Helper: hämta details strikt typat
  const fetchDetails = useCallback(async (type: "movie" | "tv", id: number) => {
    const key = `${type}:${id}`;
    if (detailsRef.current[key]) return; // redan cache:ad
    try {
      const r = await fetch(`/api/tmdb/details?type=${type}&id=${id}`, { cache: "force-cache" });
      const js = (await r.json()) as ApiDetailsOk | ApiDetailsErr;
      if (!js.ok) return;
      setDetailsMap(prev => ({
        ...prev,
        [`${js.mediaType}:${js.id}`]: {
          id: js.id,
          mediaType: js.mediaType,
          title: js.title,
          overview: js.overview,
          posterUrl: js.posterUrl,
          posterPath: js.posterPath,
          year: js.year,
        },
      }));
    } catch { /* ignore */ }
  }, []);

  // Prefetch AV BÅDE AKTUELL OCH NÄSTA: fixar “första kortet saknar poster”
  useEffect(() => {
    const cur = feed[i];
    if (isRec(cur)) fetchDetails(cur.mediaType, cur.tmdbId);
    const nxt = feed[i + 1];
    if (isRec(nxt)) fetchDetails(nxt.mediaType, nxt.tmdbId);
  }, [feed, i, fetchDetails]);

  const decide = useCallback(async (kind: "like" | "dislike" | "skip" | "seen") => {
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
  }, []);

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
        setI(v => v + 1);
        setFlip(false);
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

  const cur = feed[i];

  // ---- Drag/Swipe förbättrat för mobil ----
  const cardWrapRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (cardWrapRef.current) cardWrapRef.current.style.transition = "transform 0s";
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (startX.current == null || !cardWrapRef.current) return;
    const dx = e.clientX - startX.current;
    cardWrapRef.current.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
  }, []);
  const resetCardTransform = useCallback(() => {
    if (cardWrapRef.current) {
      cardWrapRef.current.style.transition = "transform 200ms ease-out";
      cardWrapRef.current.style.transform = "";
    }
  }, []);
  const onPointerEnd = useCallback((e: React.PointerEvent) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    startX.current = null;
    if (dx > 120) { decide("like"); return; }
    if (dx < -120) { decide("dislike"); return; }
    resetCardTransform(); // snäpp tillbaka
  }, [decide, resetCardTransform]);

  // ----------------------------------------

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
          <div className="mt-4">
            <button className="border rounded px-3 py-1 mr-2" onClick={() => setI(v => v + 1)}>Fortsätt</button>
          </div>
        </div>
      ) : (
        <>
          {/* FLIP-CONTAINER: front = poster, back = detaljer */}
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
              <div
                className={`absolute inset-0 transition-transform duration-300 [transform-style:preserve-3d] ${
                  flip ? "[transform:rotateY(180deg)]" : ""
                }`}
              >
                {/* FRONT: poster (w780) */}
                <div className="absolute inset-0 [backface-visibility:hidden]">
                  {det?.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w780${det.posterPath}`}
                      alt={det.title}
                      fill
                      sizes="(min-width: 768px) 640px, 100vw"
                      className="object-cover"
                      priority
                    />
                  ) : (
                    // Skeleton tills details är hämtat
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_25%,rgba(255,255,255,0.12)_37%,rgba(255,255,255,0.06)_63%)] bg-[length:400%_100%] animate-[shimmer_1.2s_infinite] rounded-xl" />
                  )}
                </div>

                {/* BACK: detaljer */}
                <div className="absolute inset-0 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-black/50 text-white">
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
        Tips: ←/→ för Nej/Ja, ↑ för Watchlist, Space för att vända kortet.
      </div>

      {/* keyframes för skeleton */}
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
      `}</style>
    </div>
  );
}
