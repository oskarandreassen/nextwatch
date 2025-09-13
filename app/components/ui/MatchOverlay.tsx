"use client";

import { useEffect, useState } from "react";

type VibratingNavigator = Navigator & {
  vibrate?: (pattern: number | number[]) => boolean;
};

type MatchPayload = { tmdbId: number; mediaType: "movie" | "tv" };
type Details = {
  id: number;
  type: "movie" | "tv";
  title: string;
  year?: number | null;
  rating?: number | null;
  poster?: string | null;
  overview?: string | null;
};

export default function MatchOverlay({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);

  useEffect(() => {
    let t: NodeJS.Timeout | null = null;
    const poll = async () => {
      const res = await fetch(`/api/group/match?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      const m: MatchPayload | null = data?.ok && data?.match ? data.match : null;
      if (m) {
        const dres = await fetch(`/api/tmdb/details?type=${m.mediaType}&id=${m.tmdbId}`);
        const d = await dres.json().catch(() => null);
        if (d?.ok) {
          const payload: Details = {
            id: d.id,
            type: d.type,
            title: d.title,
            year: d.year ?? null,
            rating: d.rating ?? null,
            poster: d.poster ?? null,
            overview: d.overview ?? null,
          };
          setDetails(payload);
          setOpen(true);
          if (typeof navigator !== "undefined") {
            (navigator as VibratingNavigator).vibrate?.(80);
          }
        }
      }
    };
    poll();
    t = setInterval(poll, 8000);
    return () => {
      if (t) clearInterval(t);
    };
  }, [code]);

  if (!open || !details) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div
        className="max-w-md overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 text-neutral-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {details.poster && <img src={details.poster} alt={details.title} className="h-auto w-full" />}
        <div className="space-y-2 p-4">
          <div className="text-lg font-semibold">🎉 Match!</div>
          <div className="text-base">
            {details.title}
            {details.year ? ` (${details.year})` : ""}
          </div>
          {typeof details.rating === "number" && (
            <div className="text-sm text-neutral-400">★ {details.rating.toFixed(1)}</div>
          )}
          {details.overview && <p className="text-sm text-neutral-300">{details.overview}</p>}
          <button
            className="mt-2 w-full rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-900"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
