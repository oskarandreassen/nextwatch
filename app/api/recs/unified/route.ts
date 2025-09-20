// app/api/recs/unified/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * NextWatch – unified recs (V1)
 * Kandidater: trending/popular + recommendations från favoritfilm/-serie
 * Scoring: genres(+/-) + quality + lite recency
 * UI-kontrakt oförändrat.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MediaType = "movie" | "tv";

type TMDBPaged<T> = {
  page: number;
  results: T[];
  total_pages?: number;
  total_results?: number;
};

type TMDBListItem = {
  id: number;
  name?: string;      // tv
  title?: string;     // movie
  genre_ids?: number[];
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  first_air_date?: string | null;
  release_date?: string | null;
};

type TMDBGenreList = {
  genres: { id: number; name: string }[];
};

type FavoriteItem = {
  id: number;
  title: string;
  year?: string | number | null;
  poster?: string | null;
};

type ProfileDTO = {
  displayName: string | null;
  uiLanguage: string;
  region: string;
  locale: string;
  favoriteMovie: FavoriteItem | null;
  favoriteShow: FavoriteItem | null;
  favoriteGenres: string[];
  dislikedGenres: string[];
  providers: string[]; // namn – mappar vi i V2/V3
};

type UnifiedItem = {
  id: number;
  tmdbType: MediaType;
  title: string;
  year?: string;
  poster_path?: string | null;
  vote_average?: number;
};

type UnifiedOk = {
  ok: true;
  mode: "group" | "individual";
  group: { code: string; strictProviders: boolean } | null;
  language: string;
  region: string;
  usedProviderIds: number[]; // lämnas tom i V1
  items: UnifiedItem[];
};

type UnifiedErr = { ok: false; message: string };

function fail(message: string, status = 200) {
  return NextResponse.json<UnifiedErr>({ ok: false, message }, { status });
}

function getCookieString(all: Map<string, string>): string {
  // serialisera cookies till request header
  const pairs: string[] = [];
  all.forEach((v, k) => pairs.push(`${k}=${encodeURIComponent(v)}`));
  return pairs.join("; ");
}

/** TMDB fetch helper med token eller api_key */
async function tmdbGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const v4 = process.env.TMDB_v4_TOKEN;
  const v3 = process.env.TMDB_API_KEY;

  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) usp.set(k, String(v));
  }
  // v3-key fallback om v4 saknas
  if (!v4 && v3) usp.set("api_key", v3);

  const url = `https://api.themoviedb.org/3${path}${usp.toString() ? `?${usp.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: v4 ? { Authorization: `Bearer ${v4}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`TMDB ${path} ${res.status}`);
  }
  return (await res.json()) as T;
}

function pickTitle(x: TMDBListItem): string {
  return (x.title || x.name || "Untitled").trim();
}

function yearFrom(item: TMDBListItem): string | undefined {
  const d = item.release_date || item.first_air_date;
  if (!d) return undefined;
  const y = d.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : undefined;
}

/** Enkel quality-score: betyg * log10(röster+1) */
function qualityScore(voteAvg?: number, voteCount?: number): number {
  if (!voteAvg || !voteCount) return 0;
  const s = Math.log10(voteCount + 1);
  return voteAvg * s; // 0..ca 80
}

function recencyBonus(year?: string): number {
  if (!year) return 0;
  const y = Number(year);
  if (!Number.isFinite(y)) return 0;
  const now = new Date().getFullYear();
  const diff = now - y;
  if (diff <= 1) return 1.0;
  if (diff <= 3) return 0.7;
  if (diff <= 5) return 0.4;
  return 0.1;
}

function dedupe(items: { id: number; tmdbType: MediaType }[]): { id: number; tmdbType: MediaType }[] {
  const seen = new Set<string>();
  const out: { id: number; tmdbType: MediaType }[] = [];
  for (const it of items) {
    const k = `${it.tmdbType}_${it.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/** Poäng baserat på genrenamn-listor (från TMDB genre_ids + lokala genre-listor) */
function genreScore(
  itemGenreIds: number[] | undefined,
  movieIdToName: Map<number, string>,
  tvIdToName: Map<number, string>,
  type: MediaType,
  liked: Set<string>,
  disliked: Set<string>,
): number {
  if (!itemGenreIds || itemGenreIds.length === 0) return 0;
  let score = 0;
  for (const id of itemGenreIds) {
    const name =
      type === "movie" ? movieIdToName.get(id) : tvIdToName.get(id);
    if (!name) continue;
    if (liked.has(name)) score += 1.0;
    if (disliked.has(name)) score -= 1.3; // negativa väger lite mer
  }
  return score;
}

export async function GET(req: Request) {
  try {
    const c = await cookies();
    const cookieMap = new Map<string, string>();
    for (const { name, value } of c.getAll()) cookieMap.set(name, value);

    const region = cookieMap.get("nw_region") || "SE";
    const locale = cookieMap.get("nw_locale") || "sv-SE";
    const groupCode = cookieMap.get("nw_group") || null;

    // Hämta profile via intern route för att slippa Prisma-hantering här.
    const cookieHeader = getCookieString(cookieMap);
    const profRes = await fetch(`${new URL(req.url).origin}/api/profile`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!profRes.ok) {
      return fail("Kunde inte läsa profil.");
    }
    const profJson = (await profRes.json()) as { ok: boolean; profile?: ProfileDTO };
    if (!profJson.ok || !profJson.profile) {
      return fail("Ingen profil.");
    }
    const profile = profJson.profile;

    // Genre-listor (lokaliserade till locale) -> id->namn
    const [movieGenres, tvGenres] = await Promise.all([
      tmdbGet<TMDBGenreList>("/genre/movie/list", { language: locale }),
      tmdbGet<TMDBGenreList>("/genre/tv/list", { language: locale }),
    ]);
    const movieIdToName = new Map<number, string>(movieGenres.genres.map(g => [g.id, g.name]));
    const tvIdToName = new Map<number, string>(tvGenres.genres.map(g => [g.id, g.name]));

    const liked = new Set(profile.favoriteGenres ?? []);
    const disliked = new Set(profile.dislikedGenres ?? []);

    // --- Kandidater ---
    const page = new URL(req.url).searchParams.get("page");
    const pageNum = Math.max(1, Number(page || "1"));

    const [
      trMovie,
      trTv,
      popMovie,
      popTv,
    ] = await Promise.all([
      tmdbGet<TMDBPaged<TMDBListItem>>("/trending/movie/day", { language: locale, region }),
      tmdbGet<TMDBPaged<TMDBListItem>>("/trending/tv/day", { language: locale, region }),
      tmdbGet<TMDBPaged<TMDBListItem>>("/movie/popular", { language: locale, region, page: pageNum }),
      tmdbGet<TMDBPaged<TMDBListItem>>("/tv/popular", { language: locale, region, page: pageNum }),
    ]);

    const seeds: { id: number; type: MediaType }[] = [];
    if (profile.favoriteMovie?.id) seeds.push({ id: profile.favoriteMovie.id, type: "movie" });
    if (profile.favoriteShow?.id) seeds.push({ id: profile.favoriteShow.id, type: "tv" });

    const recCalls = await Promise.all(
      seeds.map(s =>
        tmdbGet<TMDBPaged<TMDBListItem>>(
          s.type === "movie" ? `/movie/${s.id}/recommendations` : `/tv/${s.id}/recommendations`,
          { language: locale, region }
        ).catch(() => ({ page: 1, results: [] as TMDBListItem[] }))
      )
    );

    // Kombinera & dedupe
    const raw: { id: number; tmdbType: MediaType; source: string; item: TMDBListItem }[] = [];
    for (const r of trMovie.results) raw.push({ id: r.id, tmdbType: "movie", source: "trending", item: r });
    for (const r of trTv.results)    raw.push({ id: r.id, tmdbType: "tv",    source: "trending", item: r });
    for (const r of popMovie.results) raw.push({ id: r.id, tmdbType: "movie", source: "popular", item: r });
    for (const r of popTv.results)    raw.push({ id: r.id, tmdbType: "tv",    source: "popular", item: r });

    for (const rc of recCalls) {
      for (const r of rc.results) {
        // Vi vet inte typ här – men vi vet det från seed; vi lägger in båda seed-kategorier separat ovan, så bra här:
        // Vi avgör typ via titel/name heuristik: recommendations följer samma typ som seed i TMDB.
        // För säkerhets skull stoppar vi in som "movie" om title finns, annars "tv".
        const typ: MediaType = r.title ? "movie" : "tv";
        raw.push({ id: r.id, tmdbType: typ, source: "seed", item: r });
      }
    }

    // Dedupe by (type,id)
    const uniq = dedupe(raw.map(r => ({ id: r.id, tmdbType: r.tmdbType })));
    const mapKeyToItem = new Map<string, TMDBListItem>();
    const mapKeyToType = new Map<string, MediaType>();
    for (const r of raw) {
      const k = `${r.tmdbType}_${r.id}`;
      if (!mapKeyToItem.has(k)) {
        mapKeyToItem.set(k, r.item);
        mapKeyToType.set(k, r.tmdbType);
      }
    }

    // Score
    type Scored = { key: string; id: number; type: MediaType; score: number; base: TMDBListItem };
    const scored: Scored[] = [];
    for (const k of uniq.map(u => `${u.tmdbType}_${u.id}`)) {
      const it = mapKeyToItem.get(k);
      const type = mapKeyToType.get(k);
      if (!it || !type) continue;

      const gScore = genreScore(it.genre_ids, movieIdToName, tvIdToName, type, liked, disliked);
      const qScore = qualityScore(it.vote_average, it.vote_count);
      const rBonus = recencyBonus(yearFrom(it));

      // viktning V1 – enkel och förklarbar
      const final = 1.6 * gScore + 0.6 * qScore + 0.2 * rBonus;

      scored.push({ key: k, id: it.id, type, score: final, base: it });
    }

    // sortera & skär av
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 100);

    const items: UnifiedItem[] = top.map(s => ({
      id: s.id,
      tmdbType: s.type,
      title: pickTitle(s.base),
      year: yearFrom(s.base),
      poster_path: s.base.poster_path ?? null,
      vote_average: s.base.vote_average,
    }));

    const payload: UnifiedOk = {
      ok: true,
      mode: groupCode ? "group" : "individual",
      group: groupCode ? { code: groupCode, strictProviders: false } : null,
      language: locale,
      region,
      usedProviderIds: [], // V1: ej mappat
      items,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("unified recs error:", err);
    return fail("Internt fel vid rekommendation.");
  }
}
