"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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

function SwipeInner() {
  const sp = useSearchParams();
  const media = (sp?.get("media") || "both") as "movie"|"tv"|"both";

  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/recs/personal?media=${media}&limit=40`)
      .then(r => r.json())
      .then(js => js.ok ? setFeed(js.feed as FeedItem[]) : setErr(js.error || "Fel"))
      .catch(e => setErr(String(e)));
  }, [media]);

  // Tangenter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!feed[i] || feed[i].type === "ad") return;
      if (e.key === "ArrowLeft") decide("dislike");
      if (e.key === "ArrowRight") decide("like");
      if (e.key === "ArrowUp") toggleWatch();
      if (e.key === " ") setFlip(f => !f);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feed, i]);

  const cur = feed[i];

  async function decide(kind: "like" | "dislike" | "skip" | "seen") {
    const item = feed[i];
    if (!item || item.type === "ad") { setI(v => v + 1); setFlip(false); return; }
    await fetch("/api/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType, decision: kind })
    }).catch(()=>{});
    setI(v => v + 1);
    setFlip(false);
  }
  async function toggleWatch() {
    const item = feed[i];
    if (!item || item.type === "ad") return;
    await fetch("/api/watchlist/toggle", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType, add: true })
    }).catch(()=>{});
  }

  // enkel drag
  const cardRef = useRef<HTMLDivElement|null>(null);
  const startX = useRef<number|null>(null);
  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (startX.current == null || !cardRef.current) return;
    const dx = e.clientX - startX.current;
    cardRef.current.style.transform = `translateX(${dx}px) rotate(${dx/20}deg)`;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (startX.current == null || !cardRef.current) return;
    const dx = e.clientX - startX.current;
    cardRef.current.style.transform = "";
    startX.current = null;
    if (dx > 120) decide("like");
    else if (dx < -120) decide("dislike");
  }

  if (err) return <div className="p-6 text-red-500">{err}</div>;
  if (!cur) return <div className="p-6">Slut på förslag för nu.</div>;

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
            <button className="border rounded px-3 py-1 mr-2" onClick={()=>setI(v=>v+1)}>Fortsätt</button>
          </div>
        </div>
      ) : (
        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="relative w-full h-72 select-none [perspective:1000px]"
        >
          {/* flip container */}
          <div className={`absolute inset-0 rounded-xl shadow border bg-black/20 text-white transition-transform duration-300 [transform-style:preserve-3d] ${flip ? "[transform:rotateY(180deg)]" : ""}`}>
            {/* front */}
            <div className="absolute inset-0 p-4 [backface-visibility:hidden]">
              <div className="text-lg font-semibold">{cur.title} <span className="text-xs opacity-60">({cur.mediaType})</span></div>
              <div className="text-sm opacity-80">Providers: {cur.matchedProviders.join(", ") || (cur.unknown ? "Okänd" : "—")}</div>
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                <button className="border rounded px-4 py-2" onClick={() => decide("dislike")}>Nej ←</button>
                <button className="border rounded px-4 py-2" onClick={() => setFlip(f=>!f)}>Info</button>
                <button className="border rounded px-4 py-2" onClick={() => decide("like")}>Ja →</button>
                <button className="border rounded px-4 py-2" onClick={toggleWatch}>+ Watchlist ↑</button>
              </div>
            </div>
            {/* back */}
            <div className="absolute inset-0 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="text-lg font-semibold mb-2">Handling</div>
              <p className="text-sm opacity-80">Öppna detaljsida snart – MVP visar begränsad info här. (Klicka “Info” igen för att vända tillbaka.)</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm opacity-70">Tips: ←/→ för Nej/Ja, ↑ för Watchlist, Space för att vända kortet.</div>
    </div>
  );
}
