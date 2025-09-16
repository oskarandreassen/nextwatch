// app/api/recs/for-you/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Movie = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
};

type Paged<T> = {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
};

type Card = {
  id: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: string | null;
  poster: string | null;
};

// Svenska → TMDB ids (utökad med synonymer)
const SWEDISH_TO_TMDB: Record<string, number> = {
  Action: 28,
  Äventyr: 12,
  Animerat: 16,
  Komedi: 35,
  Kriminal: 80,
  Dokumentär: 99,
  Drama: 18,
  Familj: 10751,
  Fantasy: 14,
  Historia: 36,
  Skräck: 27,
  Musik: 10402,
  Mysterium: 9648,
  Romantik: 10749,
  // Vanligt är "Science fiction" (sv), men ibland har man "Sci-Fi"/"Sci fi"/"Science"
  "Science fiction": 878,
  "Sci-Fi": 878,
  "Sci fi": 878,
  Science: 878,
  Thriller: 53,
  Krig: 10752,
  Western: 37,
};

const READ_TOKEN = process.env.TMDB_READ_TOKEN ?? process.env.TMDB_TOKEN;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const debug = searchParams.get("debug") === "1";

  if (!READ_TOKEN) {
    return NextResponse.json(
      { ok: false, items: [], nextCursor: null, message: "TMDB_READ_TOKEN saknas (eller TMDB_TOKEN)" },
      { status: 200 }
    );
  }

  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) {
    return NextResponse.json(
      { ok: false, items: [], nextCursor: null, message: "Ingen nw_uid (inte inloggad/session saknas)" },
      { status: 200 }
    );
  }

  const cursor = searchParams.get("cursor");
  const pageNum = cursor ? Number(cursor) : 1;

  const prof = await prisma.profile.findUnique({
    where: { userId: uid },
    select: { favoriteGenres: true, region: true },
  });

  // Mappa svenska genrer -> ids
  const wanted = (prof?.favoriteGenres ?? [])
    .map((g) => SWEDISH_TO_TMDB[g])
    .filter((n): n is number => Number.isFinite(n));

  // Hämta discover (om vi har genrer), annars trending
  const result = await (wanted.length > 0
    ? discover({ genres: wanted, page: pageNum })
    : trending({ page: pageNum }));

  if (debug) {
    return NextResponse.json({ ok: true, ...result, _debug: { wanted, pageNum } });
  }
  return NextResponse.json({ ok: true, ...result });
}

/* ---- TMDB helpers ---- */

async function tmdbGet<T>(path: string, params: Record<string, string | number | boolean>) {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${READ_TOKEN}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
  return (await res.json()) as T;
}

function normalize(x: Movie, mediaType: "movie" | "tv"): Card {
  const title = mediaType === "movie" ? x.title ?? "" : x.name ?? "";
  const date = mediaType === "movie" ? x.release_date : x.first_air_date;
  const year = date && date.length >= 4 ? date.slice(0, 4) : null;
  return {
    id: `${mediaType}_${x.id}`,
    tmdbId: x.id,
    mediaType,
    title,
    year,
    poster: x.poster_path ? `https://image.tmdb.org/t/p/w500${x.poster_path}` : null,
  };
}

async function discover({ genres, page }: { genres: number[]; page: number }) {
  const [movie, tv] = await Promise.all([
    tmdbGet<Paged<Movie>>("discover/movie", {
      page,
      with_genres: genres.join(","),
      include_adult: false,
      sort_by: "popularity.desc",
      "vote_count.gte": 10,
    }),
    tmdbGet<Paged<Movie>>("discover/tv", {
      page,
      with_genres: genres.join(","),
      include_adult: false,
      sort_by: "popularity.desc",
      "vote_count.gte": 10,
    }),
  ]);

  // Blanda film/serie
  const mixed: Card[] = [];
  const max = Math.max(movie.results.length, tv.results.length);
  for (let i = 0; i < max; i++) {
    if (movie.results[i]) mixed.push(normalize(movie.results[i], "movie"));
    if (tv.results[i]) mixed.push(normalize(tv.results[i], "tv"));
  }

  const items = mixed.slice(0, 100);
  const hasMore = page + 1 <= Math.max(movie.total_pages, tv.total_pages);

  // Om discover gav tomt (ovanligt), fall tillbaka till trending
  if (items.length === 0) {
    return trending({ page });
  }
  return { items, nextCursor: hasMore ? String(page + 1) : null };
}

async function trending({ page }: { page: number }) {
  const [movie, tv] = await Promise.all([
    tmdbGet<Paged<Movie>>("trending/movie/week", { page }),
    tmdbGet<Paged<Movie>>("trending/tv/week", { page }),
  ]);
  const mixed: Card[] = [];
  const max = Math.max(movie.results.length, tv.results.length);
  for (let i = 0; i < max; i++) {
    if (movie.results[i]) mixed.push(normalize(movie.results[i], "movie"));
    if (tv.results[i]) mixed.push(normalize(tv.results[i], "tv"));
  }
  const items = mixed.slice(0, 100);
  const hasMore = page + 1 <= Math.max(movie.total_pages, tv.total_pages);
  return { items, nextCursor: hasMore ? String(page + 1) : null };
}
