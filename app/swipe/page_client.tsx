"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimation } from "framer-motion";

type MediaType = "movie" | "tv";

export type Card = {
  id: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: string | null;
  poster: string | null;
  overview?: string | null;
  rating?: number | null;
};

type ApiRes = {
  ok: boolean;
  items?: Card[];
  nextCursor?: string | null;
  message?: string;
};

const HIDE_KEY = "nw_disliked_until"; // { [tmdbId]: epoch_ms_until }

function readHideMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HIDE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, number>;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}
function writeHideMap(map: Record<string, number>) {
  localStorage.setItem(HIDE_KEY, JSON.stringify(map));
}

function isHidden(tmdbId: number): boolean {
  const map = readHideMap();
  const until = map[String(tmdbId)];
  return typeof until === "number" && Date.now() < until;
}

function hideFor7Days(tmdbId: number) {
  const map = readHideMap();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  map[String(tmdbId)] = Date.now() + sevenDays;
  writeHideMap(map);
}

export default function SwipePageClient() {
  const [cards, setCards] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flippedId, setFlippedId] = useState<string | null>(null);

  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const topCard = cards[0];
  const restCards = useMemo(() => cards.slice(1), [cards]);

  const loadMore = useCallback(
    async (initial: boolean) => {
      if (loading) return;
      setLoading(true);
      try {
        const url = new URL("/api/recs", window.location.origin);
        if (!initial && cursor) url.searchParams.set("cursor", cursor);
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = (await res.json()) as ApiRes;
        if (data.ok && data.items) {
          const filtered = data.items.filter((c) => !isHidden(c.tmdbId));
          setCards((prev) => (initial ? filtered : [...prev, ...filtered]));
          setCursor(data.nextCursor ?? null);
        }
      } finally {
        setLoading(false);
      }
    },
    [cursor, loading]
  );

  // Första laddning
  useEffect(() => {
    void loadMore(true);
  }, [loadMore]);

  // Autoladda när det börjar ta slut
  useEffect(() => {
    if (!loading && cards.length < 6 && cursor) {
      void loadMore(false);
    }
  }, [cards.length, cursor, loading, loadMore]);

  function popTop() {
    setFlippedId(null);
    setCards((prev) => prev.slice(1));
  }

  async function handleDislike(c: Card) {
    hideFor7Days(c.tmdbId);
    popTop();
  }

  async function handleLike(c: Card) {
    try {
      const res = await fetch("/api/watchlist/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          tmdbId: c.tmdbId,
          mediaType: c.mediaType,
          title: c.title,
          year: c.year,
          poster: c.poster,
        }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message || "Kunde inte lägga till i watchlist");
      setToast("Tillagd i Watchlist ✅");
    } catch {
      setToast("Misslyckades att lägga till ❌");
    } finally {
      window.setTimeout(() => setToast(null), 1500);
      popTop();
    }
  }

  function onInfo(c: Card) {
    setFlippedId((prev) => (prev === c.id ? null : c.id));
  }

  const swipeThreshold = 120; // px

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-md" style={{ minHeight: 520 }}>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded bg-black/80 px-4 py-2 text-sm text-white shadow">
          {toast}
        </div>
      )}

      {/* stack understa korten */}
      {restCards.slice(0, 4).map((c, i) => (
        <div
          key={c.id}
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `translateY(${12 * (restCards.length - i)}px) scale(${1 - i * 0.03})`, opacity: 0.9 - i * 0.12 }}
        >
          <StaticCard card={c} flipped={false} onFlip={() => {}} />
        </div>
      ))}

      {/* top-kort */}
      {topCard ? (
        <motion.div
          key={topCard.id}
          className="absolute inset-0 flex items-center justify-center"
          animate={controls}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            const x = info.offset.x;
            if (x > swipeThreshold) {
              void controls.start({ x: 500, rotate: 20, opacity: 0, transition: { duration: 0.25 } }).then(() => {
                void handleLike(topCard);
                void controls.start({ x: 0, rotate: 0, opacity: 1 });
              });
            } else if (x < -swipeThreshold) {
              void controls.start({ x: -500, rotate: -20, opacity: 0, transition: { duration: 0.25 } }).then(() => {
                void handleDislike(topCard);
                void controls.start({ x: 0, rotate: 0, opacity: 1 });
              });
            } else {
              void controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
            }
          }}
        >
          <StaticCard
            card={topCard}
            flipped={flippedId === topCard.id}
            onFlip={() => setFlippedId((p) => (p === topCard.id ? null : topCard.id))}
          />
        </motion.div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-70">
          {loading ? "Laddar..." : "Slut på förslag nu."}
        </div>
      )}

      {/* knappar */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-3 flex items-center justify-center gap-6">
        <button
          aria-label="Nej"
          onClick={() => topCard && void handleDislike(topCard)}
          className="h-12 w-12 rounded-full bg-white/10 text-red-400 ring-1 ring-white/20 hover:bg-white/20"
        >
          ✖
        </button>
        <button
          aria-label="Info"
          onClick={() => topCard && onInfo(topCard)}
          className="h-12 w-12 rounded-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20"
        >
          i
        </button>
        <button
          aria-label="Gilla"
          onClick={() => topCard && void handleLike(topCard)}
          className="h-12 w-12 rounded-full bg-white/10 text-green-400 ring-1 ring-white/20 hover:bg-white/20"
        >
          ❤
        </button>
      </div>
    </div>
  );
}

/* ==================== KORT ==================== */

function StaticCard({ card, flipped, onFlip }: { card: Card; flipped: boolean; onFlip: () => void }) {
  return (
    <div className="relative h-[480px] w-[320px] cursor-pointer [perspective:1000px]" onClick={onFlip}>
      <div
        className="relative h-full w-full rounded-xl border border-white/15 bg-black/40 shadow-lg transition-transform duration-300 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front */}
        <div className="absolute inset-0 p-2 [backface-visibility:hidden]">
          <Front card={card} />
        </div>
        {/* Back */}
        <div className="absolute inset-0 rotate-y-180 p-3 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <Back card={card} />
        </div>
      </div>
    </div>
  );
}

function Front({ card }: { card: Card }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl">
      {card.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.poster} alt={card.title} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-800">{card.title}</div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 p-3">
        <div className="h-24 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="-mt-20 flex flex-col px-1">
          <div className="text-lg font-semibold text-white drop-shadow">
            {card.title}
            {card.year ? <span className="ml-2 opacity-80">({card.year})</span> : null}
          </div>
        </div>
      </div>
      {typeof card.rating === "number" ? (
        <div className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-yellow-300">
          ★ {card.rating.toFixed(1)}
        </div>
      ) : null}
    </div>
  );
}

function Back({ card }: { card: Card }) {
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-xl bg-neutral-950/90 p-3">
      <div className="text-base font-semibold">
        {card.title} {card.year ? <span className="opacity-70">({card.year})</span> : null}
      </div>
      {typeof card.rating === "number" ? (
        <div className="text-sm opacity-80">Betyg: ★ {card.rating.toFixed(1)} / 10</div>
      ) : null}
      <div className="mt-2 max-h-[75%] overflow-auto text-sm leading-relaxed opacity-90">
        {card.overview || "Ingen beskrivning tillgänglig."}
      </div>
    </div>
  );
}
