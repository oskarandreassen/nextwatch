"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Poster = { id: number; title: string; year: string; src: string };

type Props = {
  /** Längre duration = långsammare. Default 24000ms (halverad hastighet mot tidigare). */
  durationMs?: number;
  /** Extra klasser för placering. */
  className?: string;
  /** Överskriv höjdklasser vid behov. */
  heightClass?: string;
};

/** Sömlös poster-reel med “starta först när laddad”-logik. */
export default function HeroReel({
  durationMs = 24000,
  className,
  heightClass,
}: Props) {
  const [items, setItems] = useState<Poster[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const marked = useRef<Set<string>>(new Set());

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const res = await fetch("/api/tmdb/landing-posters", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: boolean; posters?: Poster[] };
        if (on && data?.ok && data.posters) setItems(data.posters);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      on = false;
    };
  }, []);

  // duplicera för ändlös loop
  const loop = items.length > 0 ? [...items, ...items] : [];
  const ready = loadedCount >= Math.min(6, items.length); // börja animera när minst sex är klara

  const fallback =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='228' height='342'><rect width='100%' height='100%' rx='12' fill='black'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='white' opacity='0.35' font-family='Inter,system-ui,Segoe UI,Helvetica,Arial' font-size='14'>NextWatch</text></svg>`
    );

  return (
    <div
      className={[
        "relative w-full overflow-hidden",
        heightClass ?? "h-[200px] sm:h-[240px] md:h-[280px]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="absolute left-0 top-0 flex h-full w-max items-center gap-4 will-change-transform"
        style={{
          animation: `nw-reel ${Math.max(6000, durationMs)}ms linear infinite`,
          animationPlayState: ready ? "running" : "paused",
        }}
        aria-hidden
      >
        {loop.map((p, i) => (
          <div
            key={`${p.id}-${i}`}
            className="relative h-[88%] w-[136px] sm:w-[160px] md:w-[180px] shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg"
            title={p.title}
            draggable={false}
          >
            <Image
              src={p.src}
              alt={p.title}
              fill
              sizes="(max-width: 640px) 136px, (max-width: 768px) 160px, 180px"
              className="object-cover"
              priority={i < 2}
              fetchPriority={i < 2 ? "high" : "low"}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement & { src: string };
                if (el && el.src !== fallback) el.src = fallback;
              }}
              onLoadingComplete={() => {
                const key = `${p.id}-${i}`;
                if (!marked.current.has(key)) {
                  marked.current.add(key);
                  setLoadedCount((c) => c + 1);
                }
              }}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/0 to-white/5" />
          </div>
        ))}
      </div>

      {/* mjuk överton för läsbarhet */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />
      <style jsx>{`
        @keyframes nw-reel {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
