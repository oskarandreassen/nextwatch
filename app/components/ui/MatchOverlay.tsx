// app/components/ui/MatchOverlay.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type VibratingNavigator = Navigator & {
  vibrate?: (pattern: number | number[]) => boolean;
};

type MatchPayload = { tmdbId: number; mediaType: "movie" | "tv" };

type MatchResponseOk = {
  ok: true;
  match: MatchPayload | null;
  matches?: MatchPayload[];
};

type MatchResponseErr = { ok: false; error: string };

type Details = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string | null;
  voteAverage: number | null;
  posterUrl: string | null;
  blurDataURL?: string | null;
  overview?: string | null;
};

function readGroupFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)nw_group=([^;]+)/);
  return m ? decodeURIComponent(m[1]).toUpperCase() : null;
}

export default function MatchOverlay({ code }: { code?: string }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);

  const effectiveCode = useMemo(
    () => (code && code.trim() ? code.toUpperCase() : readGroupFromCookie()),
    [code],
  );

  useEffect(() => {
    if (!effectiveCode) return;

    let t: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const res = await fetch(`/api/group/match?code=${encodeURIComponent(effectiveCode)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;

        const data = (await res.json()) as MatchResponseOk | MatchResponseErr;

        let first: MatchPayload | null = null;
        if ("ok" in data && data.ok) {
          first = data.match ?? (Array.isArray(data.matches) ? data.matches[0] ?? null : null);
        }
        if (!first) return;

        const dres = await fetch(
          `/api/tmdb/details?type=${first.mediaType}&id=${first.tmdbId}`,
          { cache: "no-store" },
        );
        if (!dres.ok) return;

        const d = (await dres.json()) as
          | {
              ok: true;
              id: number;
              mediaType: "movie" | "tv";
              title: string;
              overview?: string;
              posterUrl: string | null;
              blurDataURL?: string | null;
              year: string | null;
              voteAverage: number | null;
            }
          | { ok: false; error: string };

        if ("ok" in d && d.ok) {
          const payload: Details = {
            id: d.id,
            mediaType: d.mediaType,
            title: d.title,
            year: d.year ?? null,
            voteAverage: d.voteAverage ?? null,
            posterUrl: d.posterUrl ?? null,
            blurDataURL: d.blurDataURL ?? null,
            overview: d.overview ?? null,
          };
          setDetails(payload);
          setOpen(true);
          if (typeof navigator !== "undefined") {
            (navigator as VibratingNavigator).vibrate?.(80);
          }
        }
      } catch {
        // svälj nätverksfel – nytt försök vid nästa poll
      }
    };

    void poll();
    t = setInterval(poll, 8000);

    return () => {
      if (t) clearInterval(t);
    };
  }, [effectiveCode]);

  if (!effectiveCode) return null;
  if (!open || !details) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
      <div
        className="max-w-md overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 text-neutral-100 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {details.posterUrl && (
          <Image
            src={details.posterUrl}
            alt={details.title}
            width={800}
            height={1200}
            placeholder={details.blurDataURL ? "blur" : "empty"}
            blurDataURL={details.blurDataURL ?? undefined}
            className="h-auto w-full"
            priority={false}
          />
        )}
        <div className="space-y-2 p-4">
          <div className="text-lg font-semibold">🎉 Match!</div>
          <div className="text-base">
            {details.title}
            {details.year ? ` (${details.year})` : ""}
          </div>
          {typeof details.voteAverage === "number" && (
            <div className="text-sm text-neutral-400">★ {details.voteAverage.toFixed(1)}</div>
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
