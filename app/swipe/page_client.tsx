"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion, PanInfo } from "framer-motion";
import { Heart, X, Info } from "lucide-react";

type Card = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  poster: string | null;
  year?: string;
  rating?: number;
};

type ApiRes = { ok: boolean; items?: Card[]; message?: string };

const SWIPE_THRESHOLD = 120;

export default function SwipeClient() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const draggingRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/recs", { cache: "no-store" });
      const data = (await res.json()) as ApiRes;
      if (mounted && data.ok && data.items) {
        setCards(data.items);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const top = cards[0];
  const next = cards[1];

  async function like() {
    if (!top) return;
    // haptic
    if (typeof window !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(20);
    // add to watchlist
    // fire & forget; we don't block UI
    void fetch("/api/watchlist/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId: top.id, mediaType: top.mediaType }),
    });
    // remove card
    setCards((c) => c.slice(1));
  }

  function nope() {
    if (!top) return;
    if (typeof window !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(10);
    setCards((c) => c.slice(1));
  }

  function info() {
    if (!top) return;
    // For now: open TMDB page in new tab (simple)
    const base = top.mediaType === "movie" ? "movie" : "tv";
    window.open(`https://www.themoviedb.org/${base}/${top.id}`, "_blank", "noopener,noreferrer");
  }

  const onDragEnd = (_: unknown, info: PanInfo) => {
    draggingRef.current = false;
    const x = info.offset.x;
    if (x > SWIPE_THRESHOLD) like();
    else if (x < -SWIPE_THRESHOLD) nope();
  };

  const actionsDisabled = useMemo(() => !top || loading, [top, loading]);

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-24 pt-6">
      <div className="relative aspect-[2/3] w-full">
        {/* Mini stack (peek of next) */}
        {next && (
          <div className="absolute inset-0 translate-y-3 scale-[0.98] rounded-2xl border border-white/10 bg-black/40" />
        )}

        {/* Top card */}
        {top ? (
          <motion.div
            key={`${top.mediaType}-${top.id}`}
            className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl"
            drag="x"
            dragElastic={0.2}
            dragConstraints={{ left: 0, right: 0 }}
            onDragStart={() => (draggingRef.current = true)}
            onDragEnd={onDragEnd}
            whileDrag={{ rotate: top ? (draggingRef.current ? 2 : 0) : 0 }}
          >
            {/* Poster */}
            {top.poster && (
              <Image
                src={top.poster}
                alt={top.title}
                fill
                sizes="(max-width: 640px) 100vw, 560px"
                className="object-cover"
                priority
              />
            )}
            {/* Gradient overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            {/* Front overlay meta */}
            <div className="absolute inset-x-4 bottom-4">
              <div className="mb-2 text-sm text-white/80">
                {top.year ? `${top.year}` : ""}
                {top.rating ? ` · ★${Math.round(top.rating * 10) / 10}` : ""}
              </div>
              <h2 className="text-balance text-2xl font-semibold drop-shadow-md">{top.title}</h2>
            </div>
          </motion.div>
        ) : (
          <div className="absolute inset-0 rounded-2xl border border-white/10 bg-neutral-900/60 grid place-items-center">
            <p className="text-white/70">Slut på förslag nu.</p>
          </div>
        )}
      </div>

      {/* Action dock */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Nej"
          onClick={nope}
          disabled={actionsDisabled}
          className="group inline-flex size-16 items-center justify-center rounded-full border border-white/10 bg-red-500/10 backdrop-blur transition hover:bg-red-500/20 disabled:opacity-40"
        >
          <X className="size-7 text-red-400 group-hover:scale-110 transition-transform" />
        </button>

        <button
          type="button"
          aria-label="Info"
          onClick={info}
          disabled={actionsDisabled}
          className="group inline-flex size-16 items-center justify-center rounded-full border border-white/10 bg-blue-500/10 backdrop-blur transition hover:bg-blue-500/20 disabled:opacity-40"
        >
          <Info className="size-7 text-blue-400 group-hover:scale-110 transition-transform" />
        </button>

        <button
          type="button"
          aria-label="Gilla"
          onClick={like}
          disabled={actionsDisabled}
          className="group inline-flex size-16 items-center justify-center rounded-full border border-white/10 bg-green-500/10 backdrop-blur transition hover:bg-green-500/20 disabled:opacity-40"
        >
          <Heart className="size-7 text-green-400 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-4 text-center text-sm text-white/50">Laddar rekommendationer…</div>
      )}
    </div>
  );
}
