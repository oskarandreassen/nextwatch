"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

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
  posterUrl: string | null;
  year: string | null;
};

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

  // detaljer cache
  const [detailsMap, setDetailsMap] = useState<Record<string, Details>>({});

  // Refs som speglar aktuell state → stabila callbacks utan deps-varningar
  const feedRef = useRef<FeedItem[]>([]);
  const indexRef = useRef(0);
  const detailsRef = useRef<Record<string, Details>>({});

  useEffect(() => {
    feedRef.current = feed;
  }, [feed]);
  useEffect(() => {
    indexRef.current = i;
  }, [i]);
  useEffect(() => {
    detailsRef.current = detailsMap;
  }, [detailsMap]);

  // Hämta feed
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
        } else {
          setErr(js?.error || "Fel");
        }
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [media]);

  // Prefetcha detaljer för aktuell rec
  useEffect(() => {
    const cur = feed[i];
    if (!isRec(cur)) return;
    const key = `${cur.mediaType}:${cur.tmdbId}`;
    if (detailsRef.current[key]) return; // redan hämtat

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/tmdb/details?type=${cur.mediaType}&id=${cur.tmdbId}`, {
          cache: "force-cache",
        });
        const js = (await r.json()) as
          | (Details & { ok: true })
          | { ok: false; error: string };
        if (cancelled || !("ok" in js) || !js.ok) return;
        setDetailsMap((prev) => ({ ...prev, [`${js.mediaType}:${js.id}`]: js }));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feed, i]);

  const decide = useCallback(async (kind: "like" | "dislike" | "skip" | "seen") => {
    const idx = indexRef.current;
    const item = feedRef.current[idx];
    if (!item || item.type === "ad") {
      setI((v) => v + 1);
      setFlip(false);
      return;
    }
    try {
      await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType, decision: kind }),
      });
    } catch {
      // ignore
    } finally {
      setI((v) => v + 1);
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
    } catch {
      // ignore
    }
  }, []);

  // Tangentbord
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const idx = indexRef.current;
      const item = feedRef.current[idx];
      if (!item || item.type === "ad") {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          setI((v) => v + 1);
          setFlip(false);
        }
        return;
      }
      if (e.key === "ArrowLeft") decide("dislike");
      else if (e.key === "ArrowRight") decide("like");
      else if (e.key === "ArrowUp") toggleWatch();
      else if (e.key === " ") setFlip((f) => !f);
    },
    [decide, toggleWatch]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const cur = feed[i];

  // enkel drag
  const cardRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (startX.current == null || !cardRef.current) return;
    const dx = e.clientX - startX.current;
    cardRef.current.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (startX.current == null || !cardRef.current) return;
      const dx = e.clientX - startX.current;
      cardRef.current.style.transform = "";
      startX.current = null;
      if (dx > 120) decide("like");
      else if (dx < -120) decide("dislike");
    },
    [decide]
  );

  if (err) return <div className="p-6 text-red-500">{err}</div>;
  if (!cur) return <div className="p-6">Slut på förslag för nu.</div>;

  // details för aktuell rec
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
          <a className="underline text-sm" href={cur.href}>
            {cur.cta}
          </a>
          <div className="mt-4">
            <button className="border rounded px-3 py-1 mr-2" onClick={() => setI((v) => v + 1)}>
              Fortsätt
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="relative w-full h-96 select-none [perspective:1000px]"
        >
          {/* flip container */}
          <div
            className={`absolute inset-0 rounded-xl shadow border bg-black/20 text-white transition-transform duration-300 [transform-style:preserve-3d] ${
              flip ? "[transform:rotateY(180deg)]" : ""
            }`}
          >
            {/* front */}
            <div className="absolute inset-0 p-4 [backface-visibility:hidden]">
              <div className="text-lg font-semibold">
                {cur.title}{" "}
                <span className="text-xs opacity-60">({cur.mediaType})</span>
                {det?.year ? <span className="text-xs opacity-70 ml-1">[{det.year}]</span> : null}
              </div>
              <div className="text-sm opacity-80">
                Providers: {cur.matchedProviders.join(", ") || (cur.unknown ? "Okänd" : "—")}
              </div>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                <button className="border rounded px-4 py-2" onClick={() => decide("dislike")}>
                  Nej ←
                </button>
                <button className="border rounded px-4 py-2" onClick={() => setFlip((f) => !f)}>
                  Info
                </button>
                <button className="border rounded px-4 py-2" onClick={() => decide("like")}>
                  Ja →
                </button>
                <button className="border rounded px-4 py-2" onClick={toggleWatch}>
                  + Watchlist ↑
                </button>
              </div>
            </div>
            {/* back */}
            <div className="absolute inset-0 p-4 grid grid-cols-3 gap-3 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="col-span-1">
                {det?.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={det.posterUrl} alt={det.title} className="w-full rounded-lg" />
                ) : (
                  <div className="w-full h-48 rounded-lg border border-white/20 flex items-center justify-center text-xs opacity-70">
                    Ingen poster
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <div className="text-lg font-semibold mb-2">{det?.title || cur.title}</div>
                <p className="text-sm opacity-80">
                  {det ? det.overview || "Ingen beskrivning." : "Laddar info…"}
                </p>
                <div className="mt-3">
                  <button className="border rounded px-3 py-1" onClick={() => setFlip(false)}>
                    Tillbaka
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm opacity-70">
        Tips: ←/→ för Nej/Ja, ↑ för Watchlist, Space för att vända kortet.
      </div>
    </div>
  );
}
