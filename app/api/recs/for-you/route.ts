// app/api/recs/for-you/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { tmdbGet, TmdbPaged, READ_TOKEN } from "../../../../lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MediaType = "movie" | "tv";

type TmdbItem = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  vote_average?: number | null;
};

type Card = {
  id: number;
  mediaType: MediaType;
  title: string;
  year?: string | null;
  poster: string | null;
  rating?: number | null;
};

type Paged = { items: Card[]; nextCursor: string | null };

const SWEDISH_TO_TMDB: Record<string, number> = {
  Action: 28,
  Äventyr: 12,
  Animerat: 16,
  Komedi: 35,
  Kriminal: 80,
  Dokumentär: 99,
  Drama: 18,
  Fantasy: 14,
  "Sci-Fi": 878,
  Thriller: 53,
  Skräck: 27,
  Romantik: 10749,
};

export async function GET(req: NextRequest) {
  if (!READ_TOKEN) {
    return NextResponse.json(
      { items: [], nextCursor: null, note: "TMDB_READ_TOKEN saknas" },
      { status: 200 }
    );
  }

  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;

  const cursor = new URL(req.url).searchParams.get("cursor");
  let genres: number[] = [];

  if (uid) {
    const prof = await prisma.profile.findUnique({
      where: { userId: uid },
      select: { favoriteGenres: true },
    });
    genres = (prof?.favoriteGenres ?? [])
      .map((g) => SWEDISH_TO_TMDB[g])
      .filter((n): n is number => Number.isFinite(n));
  }

  const page = await discover({ genres, cursor });
  return NextResponse.json(page);
}

async function discover({
  genres,
  cursor,
}: {
  genres: number[];
  cursor: string | null;
}): Promise<Paged> {
  const pageNum = cursor ? Number(cursor) : 1;

  const [movie, tv] = await Promise.all([
    tmdbGet<TmdbPaged<TmdbItem>>("discover/movie", {
      include_adult: false,
      with_genres: genres.join(","),
      sort_by: "popularity.desc",
      page: pageNum,
      "vote_count.gte": 50,
      language: "sv-SE",
    }),
    tmdbGet<TmdbPaged<TmdbItem>>("discover/tv", {
      include_adult: false,
      with_genres: genres.join(","),
      sort_by: "popularity.desc",
      page: pageNum,
      "vote_count.gte": 50,
      language: "sv-SE",
    }),
  ]);

  const normalize = (r: TmdbItem, type: MediaType): Card => ({
    id: r.id,
    mediaType: type,
    title: r.title ?? r.name ?? "Okänd titel",
    year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
    poster: r.poster_path ?? null,
    rating: r.vote_average ?? null,
  });

  // Interleave
  const max = Math.max(movie.results.length, tv.results.length);
  const mixed: Card[] = [];
  for (let i = 0; i < max; i++) {
    if (movie.results[i]) mixed.push(normalize(movie.results[i], "movie"));
    if (tv.results[i]) mixed.push(normalize(tv.results[i], "tv"));
  }

  const items = mixed.slice(0, 100);
  const hasMore = pageNum + 1 <= Math.max(movie.total_pages, tv.total_pages);
  return { items, nextCursor: hasMore ? String(pageNum + 1) : null };
}
