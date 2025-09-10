"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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

function isRec(x: FeedItem): x is RecItem {
  return x.type === "rec";
}

export default function GroupSwipePage() {
  const sp = useSearchParams();
  const code = (sp.get("code") || "").toUpperCase();

  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [matchFound, setMatchFound] = useState<string | null>(null);
  const current = feed[idx];

  // Hämta gruppens feed
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!code) return;
      setLoading(true);
      const r = await fetch(`/api/recs/group?code=${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      const j = await r.json();
      if (!ignore) {
        if (j?.ok) setFeed(j.feed as FeedItem[]);
        setIdx(0);
        setLoading(false);
      }
    }
    run();
    return () => {
      ignore = true;
    };
  }, [code]);

  const decide = useCallback(
    async (decision: "like" | "dislike") => {
      const item = feed[idx];
      if (!item || !isRec(item)) {
        // hoppa över ads eller slut
        setIdx((v) => v + 1);
        return;
      }
      try {
        await fetch("/api/rate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tmdbId: item.tmdbId,
            mediaType: item.mediaType,
            decision, // "like" | "dislike"
            groupCode: code, // för ev. loggning framåt
          }),
        });

        // Efter varje like: kolla match snabbt
        if (decision === "like") {
          const m = await fetch(`/api/group/match?code=${encodeURIComponent(code)}`, {
            cache: "no-store",
          });
          const j = await m.json();
          if (j?.ok && Array.isArray(j.matches) && j.matches.length > 0) {
            setMatchFound(`Match! ${j.matches.length} träff(ar) för grupp ${code}`);
          }
        }
      } catch {
        // no-op
      } finally {
        setIdx((v) => v + 1);
      }
    },
    [feed, idx, code]
  );

  const toggleWatch = useCallback(async () => {
    const item = feed[idx];
    if (!item || !isRec(item)) {
      setIdx((v) => v + 1);
      return;
    }
    await fetch("/api/watchlist/toggle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tmdbId: item.tmdbId, mediaType: item.mediaType }),
    });
    setIdx((v) => v + 1);
  }, [feed, idx]);

  // Tangentbord: ← dislike, → like, ↑ watchlist
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") decide("dislike");
      else if (e.key === "ArrowRight") decide("like");
      else if (e.key === "ArrowUp") toggleWatch();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [decide, toggleWatch]);

  const remaining = Math.max(0, feed.length - idx - 1);

  if (!code) {
    return (
      <main className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">Grupp-swipe</h1>
        <p className="opacity-80">
          Saknar <code>?code=XXXXXX</code> i URL:en.
        </p>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Grupp-swipe</h1>
      <p className="opacity-80 mb-4">
        Kod: <span className="font-mono">{code}</span>
      </p>

      {matchFound && (
        <div className="mb-4 rounded-lg border border-green-600 p-3">
          <strong>{matchFound}</strong>
          <div className="text-sm opacity-80">
            Öppna matchlistan: <code>/group/match?code={code}</code>
          </div>
        </div>
      )}

      {loading && <p>Laddar förslag…</p>}

      {!loading && !current && (
        <div className="rounded-lg border p-4">
          <p className="mb-2">Slut på förslag nu.</p>
          <a className="underline" href={`/group/match?code=${encodeURIComponent(code)}`}>
            Visa matchlista
          </a>
        </div>
      )}

      {!loading && current && (
        <div className="rounded-xl border p-4">
          {isRec(current) ? (
            <>
              <div className="text-lg font-medium">
                {current.title}{" "}
                <span className="opacity-70 text-sm">({current.mediaType})</span>
              </div>
              <div className="text-sm opacity-80 mb-4">
                Providers:{" "}
                {current.matchedProviders.join(", ") ||
                  (current.unknown ? "okänt" : "—")}
              </div>

              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-xl border hover:bg-white/5"
                  onClick={() => decide("dislike")}
                  aria-label="Dislike (vänster pil)"
                >
                  Nej (←)
                </button>
                <button
                  className="px-4 py-2 rounded-xl border hover:bg-white/5"
                  onClick={() => toggleWatch()}
                  aria-label="Lägg till i watchlist (upp pil)"
                >
                  Watchlist (↑)
                </button>
                <button
                  className="px-4 py-2 rounded-xl border hover:bg-white/5"
                  onClick={() => decide("like")}
                  aria-label="Like (höger pil)"
                >
                  Ja (→)
                </button>
              </div>

              <div className="mt-3 text-sm opacity-70">Kvar i stacken: {remaining}</div>
            </>
          ) : (
            <>
              <div className="text-lg font-medium">{current.headline}</div>
              <div className="opacity-80 mb-3">{current.body}</div>
              <a
                className="px-4 py-2 rounded-xl border hover:bg-white/5 inline-block"
                href={current.href}
              >
                {current.cta}
              </a>
              <div className="mt-3">
                <button
                  className="text-sm underline opacity-80"
                  onClick={() => setIdx((v) => v + 1)}
                >
                  Fortsätt
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}
