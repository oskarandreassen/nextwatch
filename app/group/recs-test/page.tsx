"use client";

import { useEffect, useState } from "react";

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

export default function GroupRecsTest({ searchParams }: { searchParams: { code?: string } }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [err, setErr] = useState("");
  const code =
    (typeof window === "undefined"
      ? searchParams?.code
      : new URLSearchParams(window.location.search).get("code")) || "";

  useEffect(() => {
    if (!code) return;
    fetch(`/api/recs/group-smart?code=${encodeURIComponent(code)}&media=both&limit=30`)
      .then(r => r.json())
      .then(js => { if (js.ok) setFeed(js.feed as FeedItem[]); else setErr(js.error || "Fel"); })
      .catch(e => setErr(String(e)));
  }, [code]);

  if (!code) return <div className="p-6">Ingen kod. Gå till <a className="underline" href="/group">/group</a>.</div>;
  if (err) return <div className="p-6 text-red-400">Fel: {err}</div>;
  if (!feed.length) return <div className="p-6">Laddar eller inga resultat…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-bold">Grupprekommendationer</h1>
      {feed.map((item, idx) => (
        <div
          key={item.type === "ad" ? `ad-${item.id}-${idx}` : `rec-${(item as RecItem).tmdbId}-${idx}`}
          className="border rounded-md p-3"
        >
          {item.type === "ad" ? (
            <div>
              <div className="text-sm opacity-60 mb-1">Annons</div>
              <div className="font-medium">{item.headline}</div>
              <div className="text-sm opacity-80">{item.body}</div>
              <a className="underline text-sm" href={item.href}>{item.cta}</a>
            </div>
          ) : (
            <div>
              <div className="font-medium">
                {item.title} <span className="text-xs opacity-60">({item.mediaType})</span>
              </div>
              <div className="text-sm opacity-80">
                Providers: {item.matchedProviders.join(", ") || (item.unknown ? "Okänd" : "—")}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
