// app/api/recs/unified/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
  name?: string; // tv
  title?: string; // movie
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

type TMDBKeywords = { id: number; keywords?: { id: number; name: string }[] };
type TMDBKeywordsTV = { id: number; results?: { id: number; name: string }[] };

type TMDBCredits = {
  id: number;
  cast?: { id: number; name: string; order?: number }[];
  crew?: { id: number; name: string; job?: string; department?: string }[];
};

type TMDBDetailsWithAppends = TMDBListItem & {
  keywords?: TMDBKeywords | TMDBKeywordsTV;
  credits?: TMDBCredits;
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
  providers: string[];
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
  usedProviderIds: number[];
  items: UnifiedItem[];
};

type UnifiedErr = { ok: false; message: string };

function fail(message: string, status = 200) {
  return NextResponse.json<UnifiedErr>({ ok: false, message }, { status });
}

function getCookieString(all: Map<string, string>): string {
  const pairs: string[] = [];
  all.forEach((v, k) => pairs.push(`${k}=${encodeURIComponent(v)}`));
  return pairs.join("; ");
}

/* ---------------- TMDB helpers ---------------- */

async function tmdbGet<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  cacheMode: RequestCache = "no-store",
): Promise<T> {
  const v4 = process.env.TMDB_v4_TOKEN;
  const v3 = process.env.TMDB_API_KEY;

  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) usp.set(k, String(v));
  }
  if (!v4 && v3) usp.set("api_key", v3);

  const url = `https://api.themoviedb.org/3${path}${usp.toString() ? `?${usp.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: v4 ? { Authorization: `Bearer ${v4}` } : undefined,
    cache: cacheMode,
  });
  if (!res.ok) throw new Error(`TMDB ${path} ${res.status}`);
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

function qualityScore(voteAvg?: number, voteCount?: number): number {
  if (!voteAvg || !voteCount) return 0;
  const s = Math.log10(voteCount + 1);
  return voteAvg * s;
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

/* ---------------- Taste model (on-the-fly) ---------------- */

type Taste = {
  keywordW: Map<number, number>;
  peopleW: Map<number, number>;
};

function increment(map: Map<number, number>, key: number, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function normalizeTopK(map: Map<number, number>, k: number): Map<number, number> {
  const entries = Array.from(map.entries());
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, k);
  const max = top[0]?.[1] ?? 1;
  const out = new Map<number, number>();
  for (const [id, w] of top) out.set(id, w / max);
  return out;
}

/** Tolkar TMDB keywords-appen för movie vs tv */
function extractKeywordIds(d: TMDBDetailsWithAppends): number[] {
  const kw = d.keywords;
  if (!kw) return [];
  // movie: {keywords:[{id,name}]}, tv: {results:[{id,name}]}
  const arr =
    "keywords" in kw && Array.isArray(kw.keywords)
      ? kw.keywords
      : "results" in kw && Array.isArray(kw.results)
      ? kw.results
      : [];
  return arr.map((x) => x.id).filter((id) => Number.isFinite(id));
}

function extractPeopleIds(d: TMDBDetailsWithAppends, type: MediaType): number[] {
  const c = d.credits;
  if (!c) return [];
  const ids: number[] = [];
  // Cast: top-billed (order 0..4)
  const cast = (c.cast ?? [])
    .filter((m) => typeof m.id === "number")
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 5);
  for (const m of cast) ids.push(m.id);

  // Crew: regissör (movie) / creators (tv)
  const crew = c.crew ?? [];
  if (type === "movie") {
    for (const m of crew) if (m.job === "Director" && typeof m.id === "number") ids.push(m.id);
  } else {
    // Tv: show creators listas ofta i crew med job "Creator" eller department "Writing"
    for (const m of crew)
      if ((m.job === "Creator" || m.department === "Writing") && typeof m.id === "number") ids.push(m.id);
  }
  return ids;
}

/** Hämtar features för (type,id) med append_to_response och fallback till en-US om keywords saknas */
async function fetchFeatures(
  type: MediaType,
  id: number,
  locale: string,
): Promise<{ keywords: number[]; people: number[] }> {
  const path = type === "movie" ? `/movie/${id}` : `/tv/${id}`;
  // Först på locale, sen fallback på en-US
  const primary = await tmdbGet<TMDBDetailsWithAppends>(
    path,
    { language: locale, append_to_response: "keywords,credits" },
    "force-cache",
  ).catch(() => null);

  if (primary) {
    const kw = extractKeywordIds(primary);
    const ppl = extractPeopleIds(primary, type);
    if (kw.length > 0 || ppl.length > 0) return { keywords: kw, people: ppl };
  }

  const fallback = await tmdbGet<TMDBDetailsWithAppends>(
    path,
    { language: "en-US", append_to_response: "keywords,credits" },
    "force-cache",
  );
  return {
    keywords: extractKeywordIds(fallback),
    people: extractPeopleIds(fallback, type),
  };
}

/** Bygger smakvektor från seeds (watchlist + favorites) */
async function buildTaste(
  seeds: { id: number; type: MediaType }[],
  locale: string,
): Promise<Taste> {
  const keywordW = new Map<number, number>();
  const peopleW = new Map<number, number>();

  // Aggressiv viktning i början, planar ut med sqrt
  const alphaKw = 1.0;
  const alphaPpl = 1.0;

  // Parallelisera men håll nere antalet totalt (seeds begränsas uppströms)
  const feats = await Promise.all(
    seeds.map((s) => fetchFeatures(s.type, s.id, locale).catch(() => ({ keywords: [], people: [] }))),
  );

  for (const f of feats) {
    for (const kw of f.keywords) increment(keywordW, kw, alphaKw);
    for (const p of f.people) increment(peopleW, p, alphaPpl);
  }

  // Top-K normaliserat (håller scoringen snabb)
  return {
    keywordW: normalizeTopK(keywordW, 60),
    peopleW: normalizeTopK(peopleW, 60),
  };
}

/* ---------------- Genre scoring (från V1) ---------------- */

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
    const name = type === "movie" ? movieIdToName.get(id) : tvIdToName.get(id);
    if (!name) continue;
    if (liked.has(name)) score += 1.0;
    if (disliked.has(name)) score -= 1.3;
  }
  return score;
}

/* ---------------- Route ---------------- */

export async function GET(req: Request) {
  try {
    const c = await cookies();
    const cookieMap = new Map<string, string>();
    for (const { name, value } of c.getAll()) cookieMap.set(name, value);

    const region = cookieMap.get("nw_region") || "SE";
    const locale = cookieMap.get("nw_locale") || "sv-SE";
    const groupCode = cookieMap.get("nw_group") || null;

    // Hämta profil
    const cookieHeader = getCookieString(cookieMap);
    const profRes = await fetch(`${new URL(req.url).origin}/api/profile`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!profRes.ok) return fail("Kunde inte läsa profil.");
    const profJson = (await profRes.json()) as { ok: boolean; profile?: ProfileDTO };
    if (!profJson.ok || !profJson.profile) return fail("Ingen profil.");
    const profile = profJson.profile;

    // Genres (lokaliserade) för namn-lookup
    const [movieGenres, tvGenres] = await Promise.all([
      tmdbGet<TMDBGenreList>("/genre/movie/list", { language: locale }, "force-cache"),
      tmdbGet<TMDBGenreList>("/genre/tv/list", { language: locale }, "force-cache"),
    ]);
    const movieIdToName = new Map<number, string>(movieGenres.genres.map((g) => [g.id, g.name]));
    const tvIdToName = new Map<number, string>(tvGenres.genres.map((g) => [g.id, g.name]));
    const likedGenres = new Set(profile.favoriteGenres ?? []);
    const dislikedGenres = new Set(profile.dislikedGenres ?? []);

    // Kandidater (V1)
    const page = new URL(req.url).searchParams.get("page");
    const pageNum = Math.max(1, Number(page || "1"));

    const [trMovie, trTv, popMovie, popTv] = await Promise.all([
      tmdbGet<TMDBPaged<TMDBListItem>>("/trending/movie/day", { language: locale, region }, "force-cache"),
      tmdbGet<TMDBPaged<TMDBListItem>>("/trending/tv/day", { language: locale, region }, "force-cache"),
      tmdbGet<TMDBPaged<TMDBListItem>>("/movie/popular", { language: locale, region, page: pageNum }, "force-cache"),
      tmdbGet<TMDBPaged<TMDBListItem>>("/tv/popular", { language: locale, region, page: pageNum }, "force-cache"),
    ]);

    const baseRaw: { id: number; tmdbType: MediaType; item: TMDBListItem }[] = [];
    for (const r of trMovie.results) baseRaw.push({ id: r.id, tmdbType: "movie", item: r });
    for (const r of trTv.results) baseRaw.push({ id: r.id, tmdbType: "tv", item: r });
    for (const r of popMovie.results) baseRaw.push({ id: r.id, tmdbType: "movie", item: r });
    for (const r of popTv.results) baseRaw.push({ id: r.id, tmdbType: "tv", item: r });

    // Seeds: favoriter + watchlist
    const seedSet: { id: number; type: MediaType }[] = [];
    if (profile.favoriteMovie?.id) seedSet.push({ id: profile.favoriteMovie.id, type: "movie" });
    if (profile.favoriteShow?.id) seedSet.push({ id: profile.favoriteShow.id, type: "tv" });

    // Watchlist (intern API) – försiktig tolkning av fält
    const wlRes = await fetch(`${new URL(req.url).origin}/api/watchlist/list`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }).catch(() => null);
    if (wlRes?.ok) {
      const wlJson = (await wlRes.json().catch(() => null)) as
        | { ok: boolean; items?: unknown[] }
        | null;
      const items = (wlJson && (wlJson as { items?: unknown[] }).items) || [];
      for (const anyItem of items) {
        const obj = anyItem as Record<string, unknown>;
        const id = Number(
          (obj["tmdbId"] as number | undefined) ??
            (obj["tmdb_id"] as number | undefined) ??
            (obj["id"] as number | undefined),
        );
        const mt = (obj["mediaType"] as string | undefined) ?? (obj["media_type"] as string | undefined);
        if (Number.isFinite(id) && (mt === "movie" || mt === "tv")) {
          seedSet.push({ id, type: mt });
        }
      }
    }

    // Limitera seeds (prestanda) och dedupe
    const seedSeen = new Set<string>();
    const seeds: { id: number; type: MediaType }[] = [];
    for (const s of seedSet) {
      const k = `${s.type}_${s.id}`;
      if (seedSeen.has(k)) continue;
      seedSeen.add(k);
      seeds.push(s);
      if (seeds.length >= 25) break;
    }

    // Rekommendationer från seeds (TMDB)
    const recCalls = await Promise.all(
      seeds.slice(0, 6).map((s) =>
        tmdbGet<TMDBPaged<TMDBListItem>>(
          s.type === "movie" ? `/movie/${s.id}/recommendations` : `/tv/${s.id}/recommendations`,
          { language: locale, region },
          "force-cache",
        ).catch(() => ({ page: 1, results: [] as TMDBListItem[] })),
      ),
    );
    for (const rc of recCalls) {
      for (const r of rc.results) {
        const typ: MediaType = r.title ? "movie" : "tv";
        baseRaw.push({ id: r.id, tmdbType: typ, item: r });
      }
    }

    // Dedupe
    const uniq = dedupe(baseRaw.map((r) => ({ id: r.id, tmdbType: r.tmdbType })));
    const keyToItem = new Map<string, TMDBListItem>();
    const keyToType = new Map<string, MediaType>();
    for (const r of baseRaw) {
      const k = `${r.tmdbType}_${r.id}`;
      if (!keyToItem.has(k)) {
        keyToItem.set(k, r.item);
        keyToType.set(k, r.tmdbType);
      }
    }

    // V1-score
    type Scored = { key: string; id: number; type: MediaType; scoreV1: number; base: TMDBListItem };
    const scoredV1: Scored[] = [];
    for (const k of uniq.map((u) => `${u.tmdbType}_${u.id}`)) {
      const it = keyToItem.get(k);
      const type = keyToType.get(k);
      if (!it || !type) continue;
      const gScore = genreScore(it.genre_ids, movieIdToName, tvIdToName, type, likedGenres, dislikedGenres);
      const qScore = qualityScore(it.vote_average, it.vote_count);
      const rBonus = recencyBonus(yearFrom(it));
      const v1 = 1.6 * gScore + 0.6 * qScore + 0.2 * rBonus;
      scoredV1.push({ key: k, id: it.id, type, scoreV1: v1, base: it });
    }
    scoredV1.sort((a, b) => b.scoreV1 - a.scoreV1);

    // Bygg smakvektor (keywords + people) från seeds
    const taste = await buildTaste(seeds, locale);

    // Hämta features för top N kandidater och re-ranka (V2-score)
    const N = Math.min(60, scoredV1.length);
    const topKeys = scoredV1.slice(0, N).map((s) => ({ key: s.key, id: s.id, type: s.type }));

    // mini-cache för feature-anrop inom detta request
    const featureCache = new Map<string, { keywords: number[]; people: number[] }>();
    const fetchBatch = topKeys.map(async (t) => {
      const k = `${t.type}:${t.id}:${locale}`;
      if (featureCache.has(k)) return;
      const f = await fetchFeatures(t.type, t.id, locale).catch(() => ({ keywords: [], people: [] }));
      featureCache.set(k, f);
    });
    await Promise.all(fetchBatch);

    function scoreTaste(f: { keywords: number[]; people: number[] }): number {
      let s = 0;
      for (const kw of f.keywords) {
        const w = taste.keywordW.get(kw);
        if (w) s += 1.2 * w;
      }
      for (const p of f.people) {
        const w = taste.peopleW.get(p);
        if (w) s += 1.4 * w;
      }
      return s;
    }

    type ScoredFinal = { id: number; type: MediaType; final: number; base: TMDBListItem };
    const finalList: ScoredFinal[] = [];

    for (const s of scoredV1) {
      let v2 = s.scoreV1;
      const f = featureCache.get(`${s.type}:${s.id}:${locale}`);
      if (f) {
        v2 += scoreTaste(f);
      }
      finalList.push({ id: s.id, type: s.type, final: v2, base: s.base });
    }

    finalList.sort((a, b) => b.final - a.final);

    const items: UnifiedItem[] = finalList.slice(0, 100).map((s) => ({
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
      usedProviderIds: [],
      items,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("unified recs V2 error:", err);
    return fail("Internt fel vid rekommendation.");
  }
}
