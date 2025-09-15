"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

type MediaType = "movie" | "tv";

type ContentCard = {
  kind: "content";
  id: number;
  mediaType: MediaType;
  title: string;
  year?: string | null;
  poster: string | null;
  rating?: number | null;
};

type AdCard = {
  kind: "ad";
  id: number; // negativt id för att skilja mot TMDB
};

type Card = ContentCard | AdCard;

type Paged = { items: Omit<ContentCard, "kind">[]; nextCursor: string | null };

function insertAds(items: Omit<ContentCard, "kind">[]): Card[] {
  const out: Card[] = [];
  let counter = 0;
  for (const it of items) {
    out.push({ kind: "content", ...it });
    counter += 1;
    if (counter % 10 === 0) out.push({ kind: "ad", id: -counter });
  }
  return out;
}

export default function SwipeClient() {
  const [stack, setStack] = useState<Card[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const top = stack[0];
  const nextPeek = stack[1];

  const load = useCallback(async (cur?: string | null) => {
    setLoading(true);
    try {
      const url = new URL("/api/recs/for-you", window.location.origin);
      if (cur) url.searchParams.set("cursor", cur);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as Paged;
      const withAds = insertAds(data.items);
      setStack((s) => (s.length ? [...s, ...withAds] : withAds));
      setCursor(data.nextCursor);
    } catch (e) {
      console.error("load recs failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // initial load
    void load(null);
  }, [load]);

  useEffect(() => {
    // auto-preload
    if (!loading && stack.length < 15 && cursor) void load(cursor);
  }, [stack.length, cursor, loading, load]);

  const posterUrl = useCallback((p: string | null) => {
    return p ? `https://image.tmdb.org/t/p/w780${p}` : "/placeholder-dark.png";
  }, []);

  // Typ-säker vibrate (ingen @ts-expect-error behövs)
  type NavigatorWithVibrate = Navigator & {
    vibrate?: (pattern: number | number[]) => boolean;
  };

  const vibrate = useCallback((ms: number) => {
    if (typeof navigator !== "undefined") {
      const n = navigator as NavigatorWithVibrate;
      n.vibrate?.(ms);
    }
  }, []);

  const decide = useCallback(
    async (decision: "like" | "dislike") => {
      const card = stack[0];
      if (!card || card.kind === "ad") {
        // Annons: bara dismiss
        setStack((s) => s.slice(1));
        return;
      }

      try {
        vibrate(decision === "like" ? 20 : 15);
        await fetch("/api/swipe/decide", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdbId: card.id,
            mediaType: card.mediaType,
            decision,
          }),
        });
      } catch (e) {
        console.error("decide failed:", e);
      } finally {
        setStack((s) => s.slice(1));
      }
    },
    [stack, vibrate]
  );

  // Tangentbordsgenvägar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        void decide("dislike");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        void decide("like");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [decide]);

  const empty = !top && !loading;

  const InfoRow = useMemo(() => {
    if (!top || top.kind !== "content") return null;
    const parts: string[] = [];
    if (top.year) parts.push(top.year);
    if (typeof top.rating === "number") parts.push(`★ ${top.rating.toFixed(1)}`);
    return (
      <div className="absolute bottom-4 left-4 right-4 text-sm text-white/90">
        <div className="font-semibold text-lg drop-shadow">{top.title}</div>
        {parts.length > 0 && <div className="opacity-90">{parts.join(" · ")}</div>}
      </div>
    );
  }, [top]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      {/* Större kort på desktop */}
      <div className="relative mx-auto h-[68vh] w-full max-w-xl">
        {/* Mini-stack peek */}
        {nextPeek && (
          <div className="absolute inset-0 -z-10 translate-y-3 scale-[0.99] rounded-2xl bg-neutral-800/40" />
        )}

        {/* Kort */}
        {top && (
          <div className="relative h-full w-full overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl">
            {top.kind === "ad" ? (
              <div className="flex h-full items-center justify-center">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/90">
                  Annons
                </div>
              </div>
            ) : (
              <>
                {/* Bild via next/image (fixar no-img-element) */}
                <Image
                  src={posterUrl(top.poster)}
                  alt={top.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 600px"
                  className="object-cover"
                  priority
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {InfoRow}
              </>
            )}
          </div>
        )}

        {/* Tomt-läge */}
        {empty && (
          <div className="flex h-full items-center justify-center rounded-2xl border border-white/10">
            <div className="text-white/80">Slut på förslag nu.</div>
          </div>
        )}
      </div>

      {/* Action dock */}
      <div className="mx-auto mt-6 flex w-full max-w-md items-center justify-center gap-6">
        <button
          type="button"
          aria-label="Nej"
          onClick={() => void decide("dislike")}
          className="grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white shadow-lg transition active:scale-95"
          title="Nej (←)"
        >
          ×
        </button>

        <button
          type="button"
          aria-label="Info"
          onClick={() => {
            const card = stack[0];
            if (!card || card.kind !== "content") return;
            const base = card.mediaType === "movie" ? "movie" : "tv";
            window.open(`https://www.themoviedb.org/${base}/${card.id}`, "_blank");
          }}
          className="grid h-12 w-12 place-items-center rounded-full bg-sky-600 text-white shadow-lg transition active:scale-95"
          title="Info"
        >
          i
        </button>

        <button
          type="button"
          aria-label="Gilla"
          onClick={() => void decide("like")}
          className="grid h-14 w-14 place-items-center rounded-full bg-emerald-600 text-white shadow-lg transition active:scale-95"
          title="Gilla (→)"
        >
          ❤
        </button>
      </div>
    </main>
  );
}
