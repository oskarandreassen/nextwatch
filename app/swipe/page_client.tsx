"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, useAnimation } from "framer-motion";

type MediaType = "movie" | "tv";

export type Card = {
  id: string;                 // ex: "movie_123"
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

/* ---------------- Local persistence (hide/seen) ---------------- */

const HIDE_KEY = "nw_disliked_until"; // { [tmdbId]: epoch_ms_until }
const SEEN_KEY = "nw_seen_ids";       // string[] av card.id

function readHideMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(HIDE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    return obj && typeof obj === "object" ? (obj as Record<string, number>) : {};
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

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}
function writeSeen(seen: Set<string>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen)));
}
function isSeen(id: string): boolean {
  return readSeen().has(id);
}
function markSeen(id: string) {
  const s = readSeen();
  s.add(id);
  writeSeen(s);
}

/* ---------------- Component ---------------- */

export default function SwipePageClient() {
  const [cards, setCards] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flippedId, setFlippedId] = useState<string | null>(null);

  const controls = useAnimation();

  const topCard = cards[0];
  const hasMore = useMemo(() => Boolean(cursor), [cursor]);

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
          const filtered = data.items
            .filter((c) => !isHidden(c.tmdbId))
            .filter((c) => !isSeen(c.id));
          setCards((prev) => (initial ? filtered : [...prev, ...filtered]));
          setCursor(data.nextCursor ?? null);
        }
      } finally {
        setLoading(false);
      }
    },
    [cursor, loading]
  );

  // Första laddningen
  useEffect(() => {
    void loadMore(true);
  }, [loadMore]);

  // Autoladda när det börjar ta slut
  useEffect(() => {
    if (!loading && cards.length < 3 && hasMore) {
      void loadMore(false);
    }
  }, [cards.length, hasMore, loading, loadMore]);

  function popTop() {
    setFlippedId(null);
    setCards((prev) => prev.slice(1));
  }

  async function handleDislike(c: Card) {
    markSeen(c.id);
    hideFor7Days(c.tmdbId);
    popTop();
  }

  async function handleLike(c: Card) {
    markSeen(c.id);
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

  // Mobilvänliga thresholds: trigga på avstånd ELLER hastighet
  const DIST_THRESHOLD = 110;     // px
  const VELOCITY_THRESHOLD = 700; // px/s ungefär

  return (
    <div className="relative mx-auto w-full max-w-md" style={{ minHeight: 620 }}>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 rounded-xl bg-black/85 px-4 py-2 text-sm text-white shadow">
          {toast}
        </div>
      )}

      {/* ENDAST TOPPKORT RENDERAS */}
      {topCard ? (
        <motion.div
          key={topCard.id}
          className="absolute inset-x-0 top-0 z-10 flex items-center justify-center"
          animate={controls}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            const { x } = info.offset;
            const v = info.velocity.x;

            // Right = like
            if (x > DIST_THRESHOLD || v > VELOCITY_THRESHOLD) {
              void controls
                .start({ x: 520, rotate: 18, opacity: 0, transition: { duration: 0.22 } })
                .then(() => {
                  void handleLike(topCard);
                  void controls.start({ x: 0, rotate: 0, opacity: 1 });
                });
              return;
            }
            // Left = dislike
            if (x < -DIST_THRESHOLD || v < -VELOCITY_THRESHOLD) {
              void controls
                .start({ x: -520, rotate: -18, opacity: 0, transition: { duration: 0.22 } })
                .then(() => {
                  void handleDislike(topCard);
                  void controls.start({ x: 0, rotate: 0, opacity: 1 });
                });
              return;
            }
            // Snap back
            void controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 320, damping: 28 } });
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

      {/* FOOTER-KNAPPAR – längre under, större, tydligare + exit-animationer */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-8">
        <button
          aria-label="Nej"
          onClick={() =>
            topCard &&
            (async () => {
              await controls.start({ x: -520, rotate: -18, opacity: 0, transition: { duration: 0.22 } });
              await handleDislike(topCard);
              await controls.start({ x: 0, rotate: 0, opacity: 1 });
            })()
          }
          className="h-16 w-16 rounded-full bg-red-500/15 text-red-400 ring-2 ring-red-400/40 backdrop-blur hover:bg-red-500/25 transition"
          title="Nej"
        >
          <span className="text-2xl">✖</span>
        </button>

        <button
          aria-label="Info"
          onClick={() => topCard && onInfo(topCard)}
          className="h-14 w-14 rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20 transition"
          title="Info"
        >
          <span className="text-xl">i</span>
        </button>

        <button
          aria-label="Gilla"
          onClick={() =>
            topCard &&
            (async () => {
              await controls.start({ x: 520, rotate: 18, opacity: 0, transition: { duration: 0.22 } });
              await handleLike(topCard);
              await controls.start({ x: 0, rotate: 0, opacity: 1 });
            })()
          }
          className="h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-400 ring-2 ring-emerald-400/40 backdrop-blur hover:bg-emerald-500/25 transition"
          title="Gilla"
        >
          <span className="text-2xl">❤</span>
        </button>
      </div>
    </div>
  );
}

/* ---------------- Card components ---------------- */

function StaticCard({
  card,
  flipped,
  onFlip,
}: {
  card: Card;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <div className="relative h-[520px] w-[360px] cursor-pointer [perspective:1000px]" onClick={onFlip}>
      <div
        className="relative h-full w-full rounded-2xl border border-white/15 bg-black shadow-xl transition-transform duration-300 [transform-style:preserve-3d]"
        style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* Front */}
        <div className="absolute inset-0 [backface-visibility:hidden]">
          <Front card={card} />
        </div>
        {/* Back */}
        <div className="absolute inset-0 rotate-y-180 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <Back card={card} />
        </div>
      </div>
    </div>
  );
}

function Front({ card }: { card: Card }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl">
      {card.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.poster} alt={card.title} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-neutral-800">{card.title}</div>
      )}

      {/* Titel-overlay */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
        <div className="h-28 bg-gradient-to-t from-black/90 to-transparent" />
        <div className="-mt-24 px-1">
          <div className="text-lg font-semibold text-white drop-shadow">
            {card.title}
            {card.year ? <span className="ml-2 opacity-80">({card.year})</span> : null}
          </div>
        </div>
      </div>

      {/* Rating nere till höger */}
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
    <div className="flex h-full w-full flex-col gap-2 rounded-2xl bg-neutral-950 p-4">
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
