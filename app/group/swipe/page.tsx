"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

export const dynamic = "force-dynamic";

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
  posterUrl: string | null;   // kvar för back-compat
  posterPath: string | null;  // används för w780 på fronten
  year: string | null;
};

function isRec(x: FeedItem): x is RecItem {
  return x.type === "rec";
}

function GroupSwipeInner() {
  const sp = useSearchParams();
  const code = (sp.get("code") || "").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  const [matchFound, setMatchFound] = useState<string | null>(null);

  // refs för stabila handlers
  const feedRef = useRef<FeedItem[]>([]);
  const indexRef = useRef(0);
  const [detailsMap, setDetailsMap] = useState<Record<string, Details>>({});
  const detailsRef = useRef<Record<string, Details>>({});

  useEffect(() => { feedRef.current = feed; }, [feed]);
  useEffect(() => { indexRef.current = idx; }, [idx]);
  useEffect(() => { detailsRef.current = detailsMap; }, [detailsMap]);

  // hämta gruppens feed
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!code) return;
      setLoading(true);
      const r = await fetch(`/api/recs/group?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const j = await r.json();
      if (!ignore) {
        if (j?.ok) setFeed(j.feed as FeedItem[]);
        setIdx(0);
        setFlip(false);
        setLoading(false);
      }
    }
    run();
    return () => { ignore = true; };
  }, [code]);

  // prefetch details för aktuell rec
  useEffect(() => {
    const cur = feed[idx];
    if (!cur || !isRec(cur)) return;
    const key = `${cur.mediaType}:${cur.tmdbId}`;
    if (detailsRef.current[key]) return;

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/tmdb/details?type=${cur.mediaType}&id=${cur.tmdbId}`, { cache: "force-cache" });
        const js = await r.json();
        if (cancelled || !js?.ok) return;
        const det = js as Details & { ok: true };
        setDetailsMap(prev => ({ ...prev, [`${det.mediaType}:${det.id}`]: {
          id: det.id, mediaType: det.mediaType, title: det.title, overview: det.overview,
          posterUrl: det.posterUrl, posterPath: (det as any).posterPath ?? null, year: det.year
        }}));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [feed, idx]);

  const decide = useCallback(async (decision: "like" | "dislike") => {
    const item = feedRef.current[indexRef.current];
    if (!item || !isRec(item)) {
      setIdx(v => v + 1);
      setFlip(false);
      return;
    }
    try {
      await fetch("/api/rate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType, decision, groupCode: code }),
      });
      if (decision === "like") {
        const m = await fetch(`/api/group/match?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const j = await m.json();
        if (j?.ok && Array.isArray(j.matches) && j.matches.length > 0) {
          setMatchFound(`Match! ${j.matches.length} träff(ar) för grupp ${code}`);
        }
      }
    } catch { /* no-op */ }
    finally {
      setIdx(v => v + 1);
      setFlip(false);
    }
  }, [code]);

  const toggleWatch = useCallback(async () => {
    const item = feedRef.current[indexRef.current];
    if (!item || !isRec(item)) return;
    await fetch("/api/watchlist/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType }),
    });
  }, []);

  // tangentbord
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const item = feedRef.current[indexRef.current];
      if (!item) return;
      if (e.key === "ArrowLeft") decide("dislike");
      else if (e.key === "ArrowRight") decide("like");
      else if (e.key === "ArrowUp") toggleWatch();
      else if (e.key === " ") setFlip(f => !f);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [decide, toggleWatch]);

  const current = feed[idx];
  const remaining = Math.max(0, feed.length - idx - 1);

  if (!code) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Grupp-swipe</h1>
        <p className="opacity-80">Saknar <code>?code=XXXXXX</code> i URL:en.</p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Grupp-swipe</h1>
      <p className="opacity-80 mb-4">Kod: <span className="font-mono">{code}</span></p>

      {matchFound && (
        <div className="mb-4 rounded-lg border border-green-600 p-3">
          <strong>{matchFound}</strong>
          <div className="text-sm opacity-80">Öppna matchlistan: <code>/group/match?code={code}</code></div>
        </div>
      )}

      {loading && <p>Laddar förslag…</p>}

      {!loading && !current && (
        <div className="rounded-lg border p-4">
          <p className="mb-2">Slut på förslag nu.</p>
          <a className="underline" href={`/group/match?code=${encodeURIComponent(code)}`}>Visa matchlista</a>
        </div>
      )}

      {!loading && current && (
        <div className="rounded-xl border p-4">
          {isRec(current) ? (
            <CardRec
              item={current}
              flip={flip}
              setFlip={setFlip}
              onLike={() => decide("like")}
              onDislike={() => decide("dislike")}
              onWatch={toggleWatch}
              details={detailsMap[`${current.mediaType}:${current.tmdbId}`]}
              remaining={remaining}
            />
          ) : (
            <CardAd item={current} onNext={() => setIdx(v => v + 1)} />
          )}
        </div>
      )}
    </main>
  );
}

function CardAd({ item, onNext }: { item: AdItem; onNext: () => void }) {
  return (
    <>
      <div className="text-lg font-medium">{item.headline}</div>
      <div className="opacity-80 mb-3">{item.body}</div>
      <a className="px-4 py-2 rounded-xl border hover:bg-white/5 inline-block" href={item.href}>
        {item.cta}
      </a>
      <div className="mt-3">
        <button className="text-sm underline opacity-80" onClick={onNext}>Fortsätt</button>
      </div>
    </>
  );
}

function CardRec(props: {
  item: RecItem;
  flip: boolean;
  setFlip: (v: boolean) => void;
  onLike: () => void;
  onDislike: () => void;
  onWatch: () => void;
  details?: Details;
  remaining: number;
}) {
  const { item, flip, setFlip, onLike, onDislike, onWatch, details, remaining } = props;

  return (
    <>
      {/* Kortcontainer: FRONT = poster (fast 2:3), BACK = detaljer */}
      <div className="relative w-full select-none" style={{ aspectRatio: "2 / 3" }}>
        <div
          className={`absolute inset-0 rounded-xl border transition-transform duration-300 [transform-style:preserve-3d] ${
            flip ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* FRONT: poster (skarpare via w780) */}
          <div className="absolute inset-0 [backface-visibility:hidden] overflow-hidden rounded-xl">
            {details?.posterPath ? (
              <Image
                src={`https://image.tmdb.org/t/p/w780${details.posterPath}`}
                alt={details.title}
                fill
                sizes="(min-width: 768px) 640px, 100vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-xs opacity-70">
                Ingen poster
              </div>
            )}
          </div>

          {/* BACK: detaljer */}
          <div className="absolute inset-0 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="text-lg font-medium">
              {details?.title || item.title}{" "}
              <span className="opacity-70 text-sm">{details?.year ? `[${details.year}]` : ""}</span>
            </div>
            <div className="text-sm opacity-80 mb-2">
              Providers: {item.matchedProviders.join(", ") || (item.unknown ? "okänt" : "—")}
            </div>
            <p className="text-sm opacity-90">
              {details ? details.overview || "Ingen beskrivning." : "Laddar info…"}
            </p>
            <div className="mt-3">
              <button className="border rounded px-3 py-1" onClick={() => setFlip(false)}>
                Till framsidan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Knappar under kortet */}
      <div className="mt-3 flex gap-2 justify-center">
        <button className="px-4 py-2 rounded-xl border" onClick={onDislike}>Nej (←)</button>
        <button className="px-4 py-2 rounded-xl border" onClick={() => setFlip(true)}>Info</button>
        <button className="px-4 py-2 rounded-xl border" onClick={onLike}>Ja (→)</button>
        <button className="px-4 py-2 rounded-xl border" onClick={onWatch}>Watchlist (↑)</button>
      </div>

      <div className="mt-3 text-sm opacity-70 text-center">Kvar i stacken: {remaining}</div>
    </>
  );
}

export default function GroupSwipePage() {
  return (
    <Suspense fallback={<main className="p-6 max-w-xl mx-auto">Laddar…</main>}>
      <GroupSwipeInner />
    </Suspense>
  );
}
