"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Item = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  year: string | null;
  voteAverage: number | null;
};

type ApiOk = { ok: true; page: number; totalPages: number; items: Item[] };
type ApiErr = { ok: false; error: string };

const MOVIE_GENRES = [
  ["28", "Action"], ["12", "Äventyr"], ["16", "Animerat"], ["35", "Komedi"],
  ["80", "Kriminal"], ["18", "Drama"], ["14", "Fantasy"], ["27", "Skräck"],
  ["10749", "Romantik"], ["878", "Sci-Fi"], ["53", "Thriller"],
] as const;

const TV_GENRES = [
  ["10759", "Action & Äventyr"], ["16", "Animerat"], ["35", "Komedi"],
  ["80", "Kriminal"], ["18", "Drama"], ["10765", "Sci-Fi & Fantasy"],
  ["9648", "Mystik"], ["10768", "Krig & Politik"],
] as const;

function fmtRating(v: number | null) {
  if (v == null) return "–";
  return (Math.round(v * 10) / 10).toFixed(1);
}

export default function DiscoverPage() {
  const [type, setType] = useState<"movie" | "tv">("movie");
  const [sort, setSort] = useState("popularity.desc");
  const [genres, setGenres] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  const genreList = useMemo(() => (type === "movie" ? MOVIE_GENRES : TV_GENRES), [type]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setBusy(true); setErr(null);
      try {
        const qs = new URLSearchParams({
          type,
          page: String(page),
          sort_by: sort,
        });
        if (genres.length) qs.set("with_genres", genres.join(","));
        const r = await fetch(`/api/tmdb/discover?${qs.toString()}`, { cache: "no-store" });
        const j = (await r.json()) as ApiOk | ApiErr;
        if (ignore) return;
        if (!j.ok) throw new Error(j.error);
        setItems(j.items);
      } catch (e) {
        if (!ignore) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!ignore) setBusy(false);
      }
    })();
    return () => { ignore = true; };
  }, [type, sort, genres, page]);

  function toggleGenre(id: string) {
    setPage(1);
    setGenres(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="mb-3 text-2xl font-semibold">Discover</h1>

        <div className="mb-4 grid gap-3 md:grid-cols-[auto_auto_1fr]">
          <div className="flex items-center gap-2">
            <label className="text-sm opacity-80">Typ</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value as "movie" | "tv"); setPage(1); setGenres([]); }}
              className="rounded-md border border-white/15 bg-black/40 px-2 py-1"
            >
              <option value="movie">Film</option>
              <option value="tv">Serier</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm opacity-80">Sortera</label>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="rounded-md border border-white/15 bg-black/40 px-2 py-1"
            >
              <option value="popularity.desc">Popularitet</option>
              <option value="vote_average.desc">Betyg</option>
              <option value={type === "movie" ? "primary_release_date.desc" : "first_air_date.desc"}>
                Nyast
              </option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {genreList.map(([id, name]) => (
              <button
                key={id}
                onClick={() => toggleGenre(id)}
                className={
                  "rounded-full border px-2 py-1 text-xs " +
                  (genres.includes(id)
                    ? "border-white/40 bg-white/15"
                    : "border-white/15 bg-white/5 hover:bg-white/10")
                }
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {err && <div className="mb-3 text-red-400">{err}</div>}
        {busy && <div className="mb-3 opacity-80">Laddar…</div>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((it) => (
            <a
              key={`${it.mediaType}:${it.id}`}
              href={`/swipe?media=${it.mediaType}`}
              className="group relative overflow-hidden rounded-xl border"
              title={it.title}
            >
              {it.posterPath ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w342${it.posterPath}`}
                  alt={it.title}
                  width={342}
                  height={513}
                  className="h-auto w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="aspect-[2/3] bg-white/5" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 text-[12px]">
                <div className="truncate font-medium">{it.title}</div>
                <div className="flex items-center justify-between opacity-90">
                  <span>{it.year ?? "—"}</span>
                  <span>★ {fmtRating(it.voteAverage)}</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-white/20 px-3 py-1 disabled:opacity-50"
          >
            ← Föregående
          </button>
          <span className="text-sm opacity-80">Sida {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-white/20 px-3 py-1"
          >
            Nästa →
          </button>
        </div>
      </main>

  );
}
