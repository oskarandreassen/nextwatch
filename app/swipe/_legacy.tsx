"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import ActionDock from "../components/ui/ActionDock";
import { notify } from "../components/lib/notify";

// ---- Typer ----
type MediaType = "movie" | "tv";
type BaseItem = { id: number; type: MediaType };
type Details = {
  id: number;
  type: MediaType;
  title: string;
  overview?: string | null;
  poster?: string | null;
  year?: number | null;
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

type UnifiedRespOk = {
  ok: true;
  mode: "group" | "individual";
  group: { code: string; strictProviders: boolean } | null;
  language: string;
  region: string;
  usedProviderIds: number[];
  items: UnifiedItem[];
};
type UnifiedResp = UnifiedRespOk | { ok: false; message?: string };

// ---- Hjälpare ----
const THRESH_X = 80;
const THRESH_UP = 110;

const toPoster = (p?: string | null, w: "w342" | "w500" | "w780" = "w780") =>
  !p ? null : p.startsWith("http") ? p : `https://image.tmdb.org/t/p/${w}${p}`;

type VibratingNavigator = Navigator & {
  vibrate?: (pattern: number | number[]) => boolean;
};

const vib = (ms = 24) => {
  if (typeof navigator !== "undefined") {
    (navigator as VibratingNavigator).vibrate?.(ms);
  }
};

// ---- API ----
async function fetchRecs(page = 1): Promise<BaseItem[]> {
  const res = await fetch(`/api/recs/unified?page=${page}`, { cache: "no-store" });
  if (!res.ok) return [];
  const json = (await res.json().catch(() => null)) as UnifiedResp | null;
  if (!json || !json.ok) return [];
  const mapped: BaseItem[] = json.items
    .map((it): BaseItem | null => {
      if (!Number.isFinite(it.id)) return null;
      const type = it.tmdbType;
      if (type !== "movie" && type !== "tv") return null;
      return { id: it.id, type };
    })
    .filter((v): v is BaseItem => Boolean(v));
  return mapped;
}

function detailsFromUnknown(d: unknown, fallbackType: MediaType): Details | null {
  if (typeof d !== "object" || d === null) return null;
  const o = d as Record<string, unknown>;

  const id = typeof o.id === "number" ? o.id : undefined;
  if (!id) return null;

  const title =
    (typeof o.title === "string" && o.title) ||
    (typeof o.name === "string" && o.name) ||
    "Untitled";

  const tRaw = o.type;
  const type: MediaType = tRaw === "movie" || tRaw === "tv" ? (tRaw as MediaType) : fallbackType;

  const overview = typeof o.overview === "string" ? o.overview : null;
  const poster =
    (typeof o.poster === "string" && o.poster) ||
    (typeof o.poster_path === "string" && o.poster_path) ||
    null;
  const year =
    (typeof o.year === "number" && o.year) ||
    (typeof o.releaseYear === "number" && o.releaseYear) ||
    null;

  let rating: number | null = null;
  if (typeof o.rating === "number") rating = o.rating;
  else if (typeof o.vote_average === "number") rating = o.vote_average as number;

  return { id, type, title, overview, poster, year, rating };
}

async function fetchDetails(item: BaseItem): Promise<Details | null> {
  const res = await fetch(`/api/tmdb/details?type=${item.type}&id=${item.id}`, { cache: "force-cache" });
  if (!res.ok) return null;
  const d = (await res.json().catch(() => null)) as unknown;
  return detailsFromUnknown(d, item.type);
}

async function postRate(item: BaseItem, decision: "like" | "dislike") {
  await fetch("/api/rate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: item.id, type: item.type, decision }),
  }).catch(() => {});
}

async function toggleWatchlist(item: BaseItem) {
  await fetch("/api/watchlist/toggle", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: item.id, type: item.type }),
  }).catch(() => {});
}

async function sendGroupVote(item: BaseItem, vote: "LIKE" | "DISLIKE" | "SKIP") {
  // No-op om ingen aktiv grupp; vi ignorerar fel för att inte störa UX
  await fetch("/api/group/vote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tmdbId: item.id, tmdbType: item.type, vote }),
  }).catch(() => {});
}

// ---- Komponent ----
export default function SwipeLegacy() {
  const [queue, setQueue] = useState<BaseItem[]>([]);
  const [idx, setIdx] = useState(0);

  const detailsCache = useRef<Map<string, Details | null>>(new Map());
  const [, bump] = useState(0); // force rerender

  // drag state
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [leaving, setLeaving] = useState<null | "left" | "right" | "up">(null);

  // init
  useEffect(() => {
    let alive = true;
    (async () => {
      const items = await fetchRecs(1);
      if (!alive) return;
      setQueue(items);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const current = queue[idx];
  const next = queue[idx + 1];

  // Preload current + next
  useEffect(() => {
    const want = [current, next].filter(Boolean) as BaseItem[];
    want.forEach(async (it) => {
      const key = `${it.type}:${it.id}`;
      if (!detailsCache.current.has(key)) {
        detailsCache.current.set(key, null);
        const det = await fetchDetails(it);
        detailsCache.current.set(key, det);
        bump((v) => v + 1);
      }
    });
  }, [current, next, bump]);

  const getDetails = (it?: BaseItem | null): Details | null => {
    if (!it) return null;
    const key = `${it.type}:${it.id}`;
    return detailsCache.current.get(key) ?? null;
  };

  const curDetails = getDetails(current);
  const nextDetails = getDetails(next);

  // ----- Gestik -----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!current) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !start.current) return;
    setDx(e.clientX - start.current.x);
    setDy(e.clientY - start.current.y);
  };

  const resetDrag = useCallback(() => {
    setDragging(false);
    setDx(0);
    setDy(0);
    setLeaving(null);
  }, []);

  const advance = useCallback(() => {
    setIdx((i) => i + 1);
    setFlipped(false);
    resetDrag();
  }, [resetDrag]);

  const swipeLeft = useCallback(async () => {
    if (!current) return;
    setLeaving("left");
    vib(18);
    await Promise.all([postRate(current, "dislike"), sendGroupVote(current, "DISLIKE")]);
    setTimeout(advance, 160);
  }, [current, advance]);

  const swipeRight = useCallback(async () => {
    if (!current) return;
    setLeaving("right");
    vib(26);
    await Promise.all([postRate(current, "like"), sendGroupVote(current, "LIKE")]);
    setTimeout(advance, 160);
  }, [current, advance]);

  const swipeUp = useCallback(async () => {
    if (!current) return;
    setLeaving("up");
    vib(26);
    await Promise.all([toggleWatchlist(current), sendGroupVote(current, "SKIP")]);
    notify("Added to Watchlist");
    setTimeout(advance, 160);
  }, [current, advance]);

  const onPointerUp = () => {
    if (!current) return resetDrag();
    if (dy < -THRESH_UP && Math.abs(dy) > Math.abs(dx)) {
      return void swipeUp();
    }
    if (dx > THRESH_X) {
      return void swipeRight(); // HÖGER = LIKE
    }
    if (dx < -THRESH_X) {
      return void swipeLeft(); // VÄNSTER = NOPE
    }
    resetDrag();
  };

  const onCardClickOrSpace = () => setFlipped((f) => !f);

  // ----- Tangentbord -----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        void swipeRight();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        void swipeLeft();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        void swipeUp();
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        onCardClickOrSpace();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, swipeLeft, swipeRight, swipeUp]);

  // ----- Renderhjälp -----
  const transform = useMemo(() => {
    if (leaving === "left") return "translateX(-140%) rotate(-16deg)";
    if (leaving === "right") return "translateX(140%) rotate(16deg)";
    if (leaving === "up") return "translateY(-140%)";
    const rot = dx * 0.05;
    return `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
  }, [dx, dy, leaving]);

  const poster = toPoster(curDetails?.poster, "w780");
  const miniPoster = toPoster(nextDetails?.poster, "w500");

  const onNope = useCallback(() => { void swipeLeft(); }, [swipeLeft]);
  const onLike = useCallback(() => { void swipeRight(); }, [swipeRight]);
  const onWatch = useCallback(() => { void swipeUp(); }, [swipeUp]);
  const onInfo = useCallback(() => setFlipped((f) => !f), []);

  if (!current) {
    return (
      <div className="px-4 pb-28 pt-6 md:pb-8">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-neutral-200">
          <div className="text-lg font-semibold">Slut på förslag nu.</div>
          <div className="mt-1 text-sm text-neutral-400">
            Prova Discover, ändra dina filters eller kom tillbaka senare.
          </div>
          <div className="mt-4 text-sm">
            <a
              href="/discover"
              className="rounded-md bg-white px-3 py-2 font-medium text-neutral-900"
            >
              Öppna Discover
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 pt-3 md:pb-8">
      {/* Mini-stack: topp ~12px av nästa kort */}
      {!flipped && next && miniPoster && (
        <div className="pointer-events-none mx-4 -mb-3 mt-2 rounded-[18px] border border-neutral-800/80 bg-black/50 shadow">
          <div className="relative h-3 overflow-hidden rounded-t-[18px]">
            <div className="relative h-[200px] w-full">
              <Image
                alt=""
                src={miniPoster}
                fill
                sizes="100vw"
                className="object-cover opacity-90 blur-[0.5px] rounded-t-[18px]"
                priority={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* Aktuellt kort */}
      <div className="mx-4">
        <div
          role="button"
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={onCardClickOrSpace}
          className={[
            "relative select-none rounded-[22px] border border-neutral-800 bg-neutral-900 shadow-lg",
            "touch-none will-change-transform",
            "transition-[transform,opacity] duration-150 ease-out",
          ].join(" ")}
          style={{ transform }}
        >
          {/* FRONT */}
          {!flipped && (
            <div className="relative overflow-hidden rounded-[22px]">
              <div className="absolute inset-0 bg-black" />
              {poster ? (
                <div className="relative z-[1] aspect-[2/3] w-full rounded-[22px]">
                  <Image
                    src={poster}
                    alt={curDetails?.title || "poster"}
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="rounded-[22px] object-cover"
                    priority={false}
                  />
                </div>
              ) : (
                <div className="relative z-[1] aspect-[2/3] w-full rounded-[22px] bg-neutral-800" />
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] rounded-b-[22px] bg-gradient-to-t from-black/85 via-black/20 to-transparent p-4">
                <div className="text-xl font-semibold text-white">
                  {curDetails?.title ?? "Untitled"}
                </div>
                <div className="mt-1 text-sm text-neutral-200">
                  {curDetails?.year ?? "—"}
                  {typeof curDetails?.rating === "number" ? (
                    <span> · ★ {curDetails.rating.toFixed(1)}</span>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* BACK */}
          {flipped && (
            <div className="relative overflow-hidden rounded-[22px] bg-neutral-950">
              <div className="absolute inset-0 bg-neutral-950" />
              <div className="relative z-[1] space-y-3 p-4">
                <div className="text-lg font-semibold">{curDetails?.title ?? "Untitled"}</div>
                <div className="text-sm text-neutral-300">
                  {curDetails?.overview || "Ingen beskrivning."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tipsrad */}
      <div className="mx-6 mt-3 text-center text-[13px] text-neutral-400">
        Tips: Tap/klick för att vända. ←/→ Nej/Ja, ↑ Watchlist, Space vänd.
      </div>

      {/* Tinder-dockan */}
      <ActionDock onNope={onNope} onInfo={onInfo} onWatchlist={onWatch} onLike={onLike} />
    </div>
  );
}
