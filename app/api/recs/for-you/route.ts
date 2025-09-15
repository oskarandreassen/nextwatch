// app/api/recs/for-you/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import {
  namesToGenreIds,
  discoverByGenres,
  trendingFallback,
  tmdbPoster,
  TmdbMovie,
  TmdbTv,
} from "../../../../lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Card = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  poster: string | null;
  year?: string;
  rating?: number;
};

export async function GET() {
  try {
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: uid },
      select: { favoriteGenres: true, region: true },
    });

    const favs = profile?.favoriteGenres ?? [];
    const region = profile?.region ?? "SE";

    const { movieIds, tvIds } = namesToGenreIds(favs);

    let results: (TmdbMovie | TmdbTv)[] = [];
    if (movieIds.length || tvIds.length) {
      const [p1, p2] = await Promise.all([
        discoverByGenres(region, movieIds, tvIds, 1),
        discoverByGenres(region, movieIds, tvIds, 2),
      ]);
      results = [...p1.movies, ...p1.tv, ...p2.movies, ...p2.tv];
    } else {
      results = await trendingFallback();
    }

    // Normalize -> cards
    const cards: Card[] = results
      .map((r) => {
        if ("title" in r) {
          const m = r as TmdbMovie;
          return {
            id: m.id,
            mediaType: "movie" as const,
            title: m.title,
            overview: m.overview,
            poster: tmdbPoster(m.poster_path, "w780"),
            year: m.release_date?.slice(0, 4),
            rating: m.vote_average,
          };
        }
        const t = r as TmdbTv;
        return {
          id: t.id,
          mediaType: "tv" as const,
          title: t.name,
          overview: t.overview,
          poster: tmdbPoster(t.poster_path, "w780"),
          year: t.first_air_date?.slice(0, 4),
          rating: t.vote_average,
        };
      })
      // Remove empties / missing posters to keep UI nice
      .filter((c) => !!c.title && !!c.poster);

    // Shuffle lite + take 100
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    return NextResponse.json({ ok: true, items: cards.slice(0, 100) });
  } catch (e) {
    console.error("[recs] error:", e);
    return NextResponse.json({ ok: false, message: "Kunde inte hämta rekommendationer." }, { status: 500 });
  }
}
