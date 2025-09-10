import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = {
  id: number;
  title: string;
  posterPath: string | null;
  year: string | null;
  voteAverage: number | null;
  mediaType: "movie" | "tv";
};

type TMDBResult = {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  vote_average?: number | null;
};

type TMDBResp = {
  page?: number;
  total_pages?: number;
  results?: TMDBResult[];
};

const TMDB = "https://api.themoviedb.org/3";
const H = { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` };

function yearFrom(d: string | null | undefined): string | null {
  if (!d) return null;
  const y = d.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "movie").toLowerCase() as "movie" | "tv";
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
    const sortBy = url.searchParams.get("sort_by") || "popularity.desc";
    const withGenres = url.searchParams.get("with_genres") || "";
    const useMyProviders = url.searchParams.get("myProviders") === "1";

    // Default region/language; override from profile if available
    let region = "SE";
    let language = "sv-SE";
    let withProviders = "";

    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (uid) {
      const p = await prisma.profile.findUnique({ where: { userId: uid } });
      if (p?.region) region = p.region;
      if (p?.locale) language = p.locale;
      if (useMyProviders && Array.isArray(p?.providers) && p.providers.length > 0) {
        // NOTE: TMDb expects provider IDs; we have names. We use name filtering client-side,
        // but here we still forward monetization + region hints for better results.
        // (If you later store provider IDs, map them here and set with_watch_providers=ids)
        withProviders = ""; // left blank intentionally until IDs are stored
      }
    }

    const qs = new URLSearchParams({
      include_adult: "false",
      language,
      region,
      sort_by: sortBy,
      page: String(page),
      with_genres: withGenres,
      with_watch_monetization_types: "flatrate",
      watch_region: region,
    });
    if (withProviders) qs.set("with_watch_providers", withProviders);

    const r = await fetch(`${TMDB}/discover/${type}?${qs.toString()}`, { headers: H, next: { revalidate: 60 } });
    if (!r.ok) {
      const txt = await r.text();
      return NextResponse.json({ ok: false, error: `TMDb error ${r.status}: ${txt}` }, { status: 500 });
    }

    const d = (await r.json()) as TMDBResp;
    const items: Item[] = (d.results || []).map((it): Item => ({
      id: it.id,
      mediaType: type,
      title: it.title ?? it.name ?? "",
      posterPath: it.poster_path ?? null,
      year: type === "movie" ? yearFrom(it.release_date) : yearFrom(it.first_air_date),
      voteAverage: it.vote_average ?? null,
    }));

    return NextResponse.json({
      ok: true,
      page: d.page ?? 1,
      totalPages: d.total_pages ?? 1,
      items,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
