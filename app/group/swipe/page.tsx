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
  blurDataURL: string | null;
};
type ApiDetailsOk = Details & { ok: true };
type ApiDetailsErr = { ok: false; error: string };

function isRec(x: FeedItem): x is RecItem { return x.type === "rec"; }
function fmtRating(v: number | null): string { return v == null ? "–" : (Math.round(v * 10) / 10).toFixed(1); }

function GroupSwipeInner() {
  const sp = useSearchParams();
  const code = (sp.get("code") || "").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [flip, setFlip] = useState(false);
  const [matchFound, setMatchFound] = useState<string | null>(null);

  const [detailsMap, setDetailsMap] = useState<Record<string, Details>>({});
  const feedRef = useRef<FeedItem[]>([]);
  const indexRef = useRef(0);
  const detailsRef = useRef<Record<string, Details>>({});

  useEffect(() => { feedRef.current = feed; }, [feed]);
  useEffect(() => { indexRef.current = idx; }, [idx]);
  useEffect(() => { detailsRef.current = detailsMap; }, [detailsMap]);

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!code) return;
      setLoading(true);
      const r = await fetch(`/api/recs/group?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const j = await r.json();
      if (ignore) return;
      if (j?.ok) setFeed(j.feed as FeedItem[]);
      setIdx(0);
      setFlip(false);
      setLoading(false);
    }
    run();
    return () => { ignore = true; };
  }, [code]);

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

  useEffect(() => {
    const cur = feed[idx];
    if (cur && isRec(cur)) fetchDetails(cur.mediaType, cur.tmdbId, idx === 0 ? "no-store" : "force-cache");
    const nxt = feed[idx + 1];
    if (nxt && isRec(nxt)) fetchDetails(nxt.mediaType, nxt.tmdbId, "force-cache");
  }, [feed, idx, fetchDetails]);

  // drag/tap
  const cardRef = useRef<HTMLDivElement | null>(null);
  const startX = useRef<number | null>(null);
  const startT = useRef<number>(0);

  const resetCard = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transition = "transform 180ms ease-out";
      cardRef.current.style.transform = "";
    }
  }, []);

  const decide = useCallback(async (decision: "like" | "dislike") => {
    resetCard();
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
    } catch { /* ignore */ }
    finally {
      setIdx(v => v + 1);
      setFlip(false);
    }
  }, [code, resetCard]);

  const toggleWatch = useCallback(async () => {
    const item = feedRef.current[indexRef.current];
    if (!item || !isRec(item)) return;
    await fetch("/api/watchlist/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType }),
    });
  }, []);

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

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX;
    startT.current = e.timeStamp;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (cardRef.current) cardRef.current.style.transition = "transform 0s";
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (startX.current == null || !cardRef.current) return;
    const dx = e.clientX - startX.current;
    cardRef.current.style.transform = `translateX(${dx}px) rotate(${dx / 20}deg)`;
  }, []);
  const onPointerEnd = useCallback((e: React.PointerEvent) => {
    const sx = startX.current;
    startX.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (sx == null) return;

    const dx = e.clientX - sx;
    const dt = e.timeStamp - startT.current;
    const isTap = Math.abs(dx) < 10 && dt < 300;

    if (isTap) { setFlip(f => !f); resetCard(); return; }
    if (dx > 120) { decide("like"); return; }
    if (dx < -120) { decide("dislike"); return; }
    resetCard();
  }, [decide, resetCard]);

  const current = feed[idx];
  const details = current && isRec(current) ? detailsMap[`${current.mediaType}:${current.tmdbId}`] : undefined;

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

      {!loading && current && (
        <>
          <div
            className="[perspective:1000px] select-none cursor-grab active:cursor-grabbing"
            style={{ touchAction: "pan-y" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          >
            <div
              ref={cardRef}
              className="relative w-full overflow-hidden rounded-xl border shadow"
              style={{ aspectRatio: "2 / 3" }}
            >
              <div className={`absolute inset-0 transition-transform duration-300 [transform-style:preserve-3d] ${flip ? "[transform:rotateY(180deg)]" : ""}`}>
                {/* FRONT */}
                <div className="absolute inset-0 [backface-visibility:hidden]">
                  {details?.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w780${details.posterPath}`}
                      alt={details.title}
                      fill
                      sizes="(min-width: 768px) 640px, 100vw"
                      className="object-cover"
                      placeholder={details.blurDataURL ? "blur" : undefined}
                      blurDataURL={details.blurDataURL || undefined}
                      priority={idx === 0}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.06)_25%,rgba(255,255,255,0.12)_37%,rgba(255,255,255,0.06)_63%)] bg-[length:400%_100%] animate-[shimmer_1.2s_infinite] rounded-xl" />
                  )}

                  {/* Overlay (titel · år · betyg) */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 bg-gradient-to-t from-black/70 via-black/20 to-transparent text-white">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold truncate">
                          {details?.title ?? (isRec(current) ? current.title : "")}
                        </div>
                        <div className="text-xs opacity-90">{details?.year ?? "—"}</div>
                      </div>
                      <div className="text-sm font-medium shrink-0">★ {fmtRating(details?.voteAverage ?? null)}</div>
                    </div>
                  </div>
                </div>

                {/* BACK */}
                <div className="absolute inset-0 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-black/55 text-white">
                  {isRec(current) && (
                    <>
                      <div className="text-lg font-semibold mb-1">
                        {details?.title || current.title} {details?.year ? <span className="text-xs opacity-70">[{details.year}]</span> : null}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2 mb-3">
                        {(current.matchedProviders.length ? current.matchedProviders : (current.unknown ? ["Okänd"] : []))
                          .map((p) => (
                            <span key={p} className="px-2 py-1 text-xs rounded-full border border-white/30 bg-white/10">
                              {p}
                            </span>
                          ))}
                      </div>

                      <p className="text-sm opacity-90">{details ? details.overview || "Ingen beskrivning." : "Laddar info…"}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Knappar */}
          <div className="mt-3 flex gap-2 justify-center">
            <button className="px-4 py-2 rounded-xl border" onClick={() => decide("dislike")}>Nej (←)</button>
            <button className="px-4 py-2 rounded-xl border" onClick={() => setFlip(f => !f)}>Info</button>
            <button className="px-4 py-2 rounded-xl border" onClick={() => decide("like")}>Ja (→)</button>
            <button className="px-4 py-2 rounded-xl border" onClick={toggleWatch}>Watchlist (↑)</button>
          </div>
        </>
      )}

      {!loading && !current && (
        <div className="rounded-lg border p-4">
          <p className="mb-2">Slut på förslag nu.</p>
          <a className="underline" href={`/group/match?code=${encodeURIComponent(code)}`}>Visa matchlista</a>
        </div>
      )}

      <style jsx>{`@keyframes shimmer { 0% { background-position: 100% 0 } 100% { background-position: 0 0 } }`}</style>
    </main>
  );
}

export default function GroupSwipePage() {
  return (
    <Suspense fallback={<main className="p-6 max-w-xl mx-auto">Laddar…</main>}>
      <GroupSwipeInner />
    </Suspense>
  );
}
