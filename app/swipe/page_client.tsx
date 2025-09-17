"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
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

type UnifiedItem = {
  id: number;
  tmdbType: MediaType;
  title: string;
  year?: string;
  poster_path?: string | null;
  vote_average?: number;
};

type UnifiedResp =
  | {
      ok: true;
      mode: "group" | "individual";
      group: { code: string; strictProviders: boolean } | null;
      language: string;
      region: string;
      usedProviderIds: number[];
      items: UnifiedItem[];
    }
  | { ok: false; message?: string };

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

/* ---------------- Helpers ---------------- */

function toPoster(p?: string | null, w: "w342" | "w500" | "w780" = "w780"): string | null {
  if (!p) return null;
  return p.startsWith("http") ? p : `https://image.tmdb.org/t/p/${w}${p}`;
}

async function sendGroupVote(params: {
  tmdbId: number;
  tmdbType: MediaType;
  vote: "LIKE" | "DISLIKE" | "SKIP";
}): Promise<void> {
  await fetch("/api/group/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(params),
  }).catch(() => {});
}

/* ---------------- Component ---------------- */

export default function SwipePageClient() {
  const [cards, setCards] = useState<Card[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [flippedId, setFlippedId] = useState<string | null>(null);

  // NEW: badge-state
  const [mode, setMode] = useState<"group" | "individual">("individual");
  const [group, setGroup] = useState<{ code: string; strictProviders: boolean } | null>(null);

  const controls = useAnimation();

  const topCard = cards[0];

  const loadPage = useCallback(
    async (targetPage: number, replace: boolean) => {
      if (loading) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/recs/unified?page=${targetPage}`, { cache: "no-store" });
        if (!res.ok) {
          setHasMore(false);
          return;
        }
        const data = (await res.json()) as UnifiedResp;
        if (!("ok" in data) || !data.ok) {
          setHasMore(false);
          return;
        }

        // uppdatera badge-info varje laddning (stabilt även över pagination)
        setMode(data.mode);
        setGroup(data.group);

        const mapped: Card[] = data.items
          .map((it): Card | null => {
            if (!Number.isFinite(it.id)) return null;
            const id = `${it.tmdbType}_${it.id}`;
            const poster = toPoster(it.poster_path, "w780");
            return {
              id,
              tmdbId: it.id,
              mediaType: it.tmdbType,
              title: it.title,
              year: it.year ?? null,
              poster,
              overview: null, // unified returnerar inte overview
              rating: typeof it.vote_average === "number" ? it.vote_average : null,
            };
          })
          .filter((v): v is Card => Boolean(v))
          .filter((c) => !isHidden(c.tmdbId))
          .filter((c) => !isSeen(c.id));

        if (replace) {
          setCards(mapped);
        } else {
          setCards((prev) => [...prev, ...mapped]);
        }
        setHasMore(mapped.length > 0);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  // Första laddningen
  useEffect(() => {
    void loadPage(1, true);
  }, [loadPage]);

  // Autoladda när det börjar ta slut
  useEffect(() => {
    if (!loading && cards.length < 3 && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      void loadPage(nextPage, false);
    }
  }, [cards.length, hasMore, loading, page, loadPage]);

  function popTop() {
    setFlippedId(null);
    setCards((prev) => prev.slice(1));
  }

  async function handleDislike(c: Card) {
    markSeen(c.id);
    hideFor7Days(c.tmdbId);
    await sendGroupVote({ tmdbId: c.tmdbId, tmdbType: c.mediaType, vote: "DISLIKE" });
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
      await sendGroupVote({ tmdbId: c.tmdbId, tmdbType: c.mediaType, vote: "LIKE" });
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
      {/* Badge: visas bara i grupp-läge */}
      {mode === "group" && group?.code && (
        <div className="pointer-events-none absolute top-2 left-1/2 z-30 -translate-x-1/2 rounded-full border border-violet-500/40 bg-violet-600/15 px-3 py-1 text-xs font-medium text-violet-200 backdrop-blur">
          Swiping as: <span className="font-mono tracking-wider">{group.code}</span>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 rounded-xl bg-black/85 px-4 py-2 text-sm text-white shadow">
          {toast}
        </div>
      )}

      {/* ENDAST TOPPKORT RENDERAS */}
      {cards[0] ? (
        <motion.div
          key={cards[0].id}
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
              const c = cards[0];
              void controls
                .start({ x: 520, rotate: 18, opacity: 0, transition: { duration: 0.22 } })
                .then(async () => {
                  await handleLike(c);
                  await controls.start({ x: 0, rotate: 0, opacity: 1 });
                });
              return;
            }
            // Left = dislike
            if (x < -DIST_THRESHOLD || v < -VELOCITY_THRESHOLD) {
              const c = cards[0];
              void controls
                .start({ x: -520, rotate: -18, opacity: 0, transition: { duration: 0.22 } })
                .then(async () => {
                  await handleDislike(c);
                  await controls.start({ x: 0, rotate: 0, opacity: 1 });
                });
              return;
            }
            // Snap back
            void controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 320, damping: 28 } });
          }}
        >
          <StaticCard
            card={cards[0]}
            flipped={flippedId === cards[0].id}
            onFlip={() => setFlippedId((p) => (p === cards[0].id ? null : cards[0].id))}
          />
        </motion.div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-70">
          {loading ? "Laddar..." : "Slut på förslag nu."}
        </div>
      )}

      {/* FOOTER-KNAPPAR */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-8">
        <button
          aria-label="Nej"
          onClick={() =>
            cards[0] &&
            (async () => {
              const c = cards[0];
              await controls.start({ x: -520, rotate: -18, opacity: 0, transition: { duration: 0.22 } });
              await handleDislike(c);
              await controls.start({ x: 0, rotate: 0, opacity: 1 });
            })()
          }
          className="h-16 w-16 rounded-full bg-red-500/15 text-red-400 ring-2 ring-red-400/40 backdrop-blur transition hover:bg-red-500/25"
          title="Nej"
        >
          <span className="text-2xl">✖</span>
        </button>

        <button
          aria-label="Info"
          onClick={() => cards[0] && onInfo(cards[0])}
          className="h-14 w-14 rounded-full bg-white/10 text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/20"
          title="Info"
        >
          <span className="text-xl">i</span>
        </button>

        <button
          aria-label="Gilla"
          onClick={() =>
            cards[0] &&
            (async () => {
              const c = cards[0];
              await controls.start({ x: 520, rotate: 18, opacity: 0, transition: { duration: 0.22 } });
              await handleLike(c);
              await controls.start({ x: 0, rotate: 0, opacity: 1 });
            })()
          }
          className="h-16 w-16 rounded-full bg-emerald-500/15 text-emerald-400 ring-2 ring-emerald-400/40 backdrop-blur transition hover:bg-emerald-500/25"
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
        <div className="relative h-full w-full">
          <Image
            src={card.poster}
            alt={card.title}
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover"
            priority={false}
          />
        </div>
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
