// app/api/recs/unified/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MediaType = "movie" | "tv";

/* ---------- TMDB shared types ---------- */
type TMDBPaged<T> = { page: number; results: T[] };
type TMDBListItem = {
  id: number;
  name?: string;
  title?: string;
  genre_ids?: number[];
  poster_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  first_air_date?: string | null;
  release_date?: string | null;
};
type TMDBGenreList = { genres: { id: number; name: string }[] };

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

type TMDBWatchProviders = {
  id: number;
  results: Record<
    string,
    {
      link?: string;
      flatrate?: { provider_name: string; logo_path: string | null }[];
      rent?: { provider_name: string; logo_path: string | null }[];
      buy?: { provider_name: string; logo_path: string | null }[];
    }
  >;
};
/* -------------------------------------- */

type FavoriteItem = { id: number; title: string; year?: string | number | null; poster?: string | null };
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
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) usp.set(k, String(v));
  if (!v4 && v3) usp.set("api_key", v3);

  const url = `https://api.themoviedb.org/3${path}${usp.toString() ? `?${usp.toString()}` : ""}`;
  const res = await fetch(url, { headers: v4 ? { Authorization: `Bearer ${v4}` } : undefined, cache: cacheMode });
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
function dedupe(items: { id: number; tmdbType: MediaType }[]) {
  const seen = new Set<string>(), out: { id: number; tmdbType: MediaType }[] = [];
  for (const it of items) {
    const k = `${it.tmdbType}_${it.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/* ---------------- V2 taste model ---------------- */

type Taste = { keywordW: Map<number, number>; peopleW: Map<number, number> };
function increment(map: Map<number, number>, key: number, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}
function normalizeTopK(map: Map<number, number>, k: number) {
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, k);
  const max = entries[0]?.[1] ?? 1;
  const out = new Map<number, number>();
  for (const [id, w] of entries) out.set(id, w / max);
  return out;
}
function extractKeywordIds(d: TMDBDetailsWithAppends): number[] {
  const kw = d.keywords;
  if (!kw) return [];
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
  const cast = (c.cast ?? []).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, 5);
  for (const m of cast) if (typeof m.id === "number") ids.push(m.id);
  const crew = c.crew ?? [];
  if (type === "movie") for (const m of crew) if (m.job === "Director" && typeof m.id === "number") ids.push(m.id);
  else for (const m of crew) if ((m.job === "Creator" || m.department === "Writing") && typeof m.id === "number") ids.push(m.id);
  return ids;
}
async function fetchFeatures(type: MediaType, id: number, locale: string) {
  const path = type === "movie" ? `/movie/${id}` : `/tv/${id}`;
  const primary = await tmdbGet<TMDBDetailsWithAppends>(path, { language: locale, append_to_response: "keywords,credits" }, "force-cache").catch(() => null);
  if (primary) {
    const kw = extractKeywordIds(primary), ppl = extractPeopleIds(primary, type);
    if (kw.length || ppl.length) return { keywords: kw, people: ppl };
  }
  const fallback = await tmdbGet<TMDBDetailsWithAppends>(path, { language: "en-US", append_to_response: "keywords,credits" }, "force-cache");
  return { keywords: extractKeywordIds(fallback), people: extractPeopleIds(fallback, type) };
}
async function buildTaste(seeds: { id: number; type: MediaType }[], locale: string): Promise<Taste> {
  const keywordW = new Map<number, number>(), peopleW = new Map<number, number>();
  const feats = await Promise.all(seeds.map((s) => fetchFeatures(s.type, s.id, locale).catch(() => ({ keywords: [], people: [] }))));
  for (const f of feats) {
    for (const kw of f.keywords) increment(keywordW, kw, 1);
    for (const p of f.people) increment(peopleW, p, 1);
  }
  return { keywordW: normalizeTopK(keywordW, 60), peopleW: normalizeTopK(peopleW, 60) };
}

/* ---------------- Genre scoring (V1) ---------------- */

function genreScore(
  itemGenreIds: number[] | undefined,
  movieIdToName: Map<number, string>,
  tvIdToName: Map<number, string>,
  type: MediaType,
  liked: Set<string>,
  disliked: Set<string>,
): number {
  if (!itemGenreIds?.length) return 0;
  let score = 0;
  for (const id of itemGenreIds) {
    const name = type === "movie" ? movieIdToName.get(id) : tvIdToName.get(id);
    if (!name) continue;
    if (liked.has(name)) score += 1.0;
    if (disliked.has(name)) score -= 1.3;
  }
  return score;
}

/* ---------------- Providers (direkt TMDB) ---------------- */

type Providers = {
  link?: string;
  flatrate?: { provider_name: string; logo_path: string | null }[];
  rent?: { provider_name: string; logo_path: string | null }[];
  buy?: { provider_name: string; logo_path: string | null }[];
};

async function fetchProvidersDirect(id: number, type: MediaType, region: string): Promise<Providers | null> {
  const path = type === "movie" ? `/movie/${id}/watch/providers` : `/tv/${id}/watch/providers`;
  const data = await tmdbGet<TMDBWatchProviders>(path, {}, "force-cache").catch(() => null);
  if (!data) return null;
  const regionData = data.results?.[region];
  if (regionData) return regionData;
  return data.results["US"] ?? null;
}
function providerNames(p: Providers | null): string[] {
  const names = new Set<string>();
  if (!p) return [];
  for (const group of ["flatrate", "rent", "buy"] as const) {
    for (const it of p[group] ?? []) if (it.provider_name) names.add(it.provider_name);
  }
  return Array.from(names);
}

/* ---------------- mapLimit (concurrency) ---------------- */

async function mapLimit<T, U>(arr: T[], limit: number, fn: (t: T) => Promise<U>): Promise<U[]> {
  const out = new Array<U>(arr.length);
  let i = 0;
  const runners = new Array(Math.min(limit, arr.length)).fill(0).map(async () => {
    for (;;) {
      const idx = i++;
      if (idx >= arr.length) break;
      out[idx] = await fn(arr[idx]);
    }
  });
  await Promise.all(runners);
  return out;
}

/* ---------------- Similarity (MMR) ---------------- */

function jaccard(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
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

    const cookieHeader = getCookieString(cookieMap);

    // Profil
    const profRes = await fetch(`${new URL(req.url).origin}/api/profile`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!profRes.ok) return fail("Kunde inte läsa profil.");
    const profJson = (await profRes.json()) as { ok: boolean; profile?: ProfileDTO };
    if (!profJson.ok || !profJson.profile) return fail("Ingen profil.");
    const profile = profJson.profile;

    // Genres
    const [movieGenres, tvGenres] = await Promise.all([
      tmdbGet<TMDBGenreList>("/genre/movie/list", { language: locale }, "force-cache"),
      tmdbGet<TMDBGenreList>("/genre/tv/list", { language: locale }, "force-cache"),
    ]);
    const movieIdToName = new Map(movieGenres.genres.map((g) => [g.id, g.name] as const));
    const tvIdToName = new Map(tvGenres.genres.map((g) => [g.id, g.name] as const));
    const likedGenres = new Set(profile.favoriteGenres ?? []);
    const dislikedGenres = new Set(profile.dislikedGenres ?? []);

    // Kandidater bas
    const page = new URL(req.url).searchParams.get("page");
    const pageNum = Math.max(1, Number(page || "1"));
    const [trMovie, trTv, popMovie, popTv] = await Promise.all([
      tmdbGet<TMDBPaged<TMDBListItem>>("/trending/movie/day", { language: locale, region }, "force-cache"),
      tmdbGet<TMDBPaged<TMDBListItem>>("/trending/tv/day", { language: locale, region }, "force-cache"),
      tmdbGet<TMDBPaged<TMDBListItem>>("/movie/popular", { language: locale, region, page: pageNum }, "force-cache"),
      tmdbGet<TMDBPaged<TMDBListItem>>("/tv/popular", { language: locale, region, page: pageNum }, "force-cache"),
    ]);

    // Läs watchlist för att filtrera bort dubbletter i swipen
    const watchKeys = new Set<string>();
    const wlRes = await fetch(`${new URL(req.url).origin}/api/watchlist/list`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    }).catch(() => null);
    if (wlRes?.ok) {
      const wlJson = (await wlRes.json().catch(() => null)) as { ok?: boolean; items?: unknown[] } | null;
      const items = (wlJson?.items ?? []) as unknown[];
      for (const it of items) {
        const o = it as Record<string, unknown>;
        const id = Number((o["tmdbId"] as number | undefined) ?? (o["tmdb_id"] as number | undefined) ?? (o["id"] as number | undefined));
        const mt = (o["mediaType"] as string | undefined) ?? (o["media_type"] as string | undefined);
        if (Number.isFinite(id) && (mt === "movie" || mt === "tv")) watchKeys.add(`${mt}_${id}`);
      }
    }

    const baseRaw: { id: number; tmdbType: MediaType; item: TMDBListItem }[] = [];
    for (const r of trMovie.results) {
      const k = `movie_${r.id}`;
      if (!watchKeys.has(k)) baseRaw.push({ id: r.id, tmdbType: "movie", item: r });
    }
    for (const r of trTv.results) {
      const k = `tv_${r.id}`;
      if (!watchKeys.has(k)) baseRaw.push({ id: r.id, tmdbType: "tv", item: r });
    }
    for (const r of popMovie.results) {
      const k = `movie_${r.id}`;
      if (!watchKeys.has(k)) baseRaw.push({ id: r.id, tmdbType: "movie", item: r });
    }
    for (const r of popTv.results) {
      const k = `tv_${r.id}`;
      if (!watchKeys.has(k)) baseRaw.push({ id: r.id, tmdbType: "tv", item: r });
    }

    // Seeds (favoriter + watchlist – för taste)
    const seedsSet: { id: number; type: MediaType }[] = [];
    if (profile.favoriteMovie?.id) seedsSet.push({ id: profile.favoriteMovie.id, type: "movie" });
    if (profile.favoriteShow?.id) seedsSet.push({ id: profile.favoriteShow.id, type: "tv" });
    if (wlRes?.ok) {
      for (const k of watchKeys) {
        const [type, idStr] = k.split("_");
        const id = Number(idStr);
        if (type === "movie" || type === "tv") seedsSet.push({ id, type });
      }
    }

    const seenSeed = new Set<string>();
    const seeds: { id: number; type: MediaType }[] = [];
    for (const s of seedsSet) {
      const k = `${s.type}_${s.id}`;
      if (seenSeed.has(k)) continue;
      seenSeed.add(k);
      seeds.push(s);
      if (seeds.length >= 25) break;
    }

    // TMDB recommendations (filtrera bort watchlist)
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
        const tmdbType: MediaType = r.title ? "movie" : "tv";
        const k = `${tmdbType}_${r.id}`;
        if (!watchKeys.has(k)) baseRaw.push({ id: r.id, tmdbType, item: r });
      }
    }

    // Dedupe + index
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
      const it = keyToItem.get(k), type = keyToType.get(k);
      if (!it || !type) continue;
      const gScore = genreScore(it.genre_ids, movieIdToName, tvIdToName, type, likedGenres, dislikedGenres);
      const qScore = qualityScore(it.vote_average, it.vote_count);
      const rBonus = recencyBonus(yearFrom(it));
      scoredV1.push({ key: k, id: it.id, type, scoreV1: 1.6 * gScore + 0.6 * qScore + 0.2 * rBonus, base: it });
    }
    scoredV1.sort((a, b) => b.scoreV1 - a.scoreV1);

    // V2 taste
    const taste = await buildTaste(seeds, locale);
    const N = Math.min(60, scoredV1.length);
    const topKeys = scoredV1.slice(0, N).map((s) => ({ id: s.id, type: s.type }));

    const featureCache = new Map<string, { keywords: number[]; people: number[] }>();
    await Promise.all(
      topKeys.map(async (t) => {
        const k = `${t.type}:${t.id}:${locale}`;
        if (!featureCache.has(k)) {
          const f = await fetchFeatures(t.type, t.id, locale).catch(() => ({ keywords: [], people: [] }));
          featureCache.set(k, f);
        }
      })
    );
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

    // Providers (direkt TMDB) — begränsa samtidighet
    const providersCache = new Map<string, string[]>();
    await mapLimit(topKeys, 8, async (t) => {
      const prov = await fetchProvidersDirect(t.id, t.type, region).catch(() => null);
      providersCache.set(`${t.type}:${t.id}`, providerNames(prov));
    });

    // Gruppmedlemmar providers
    let groupProviders: string[][] = [];
    if (groupCode) {
      const gm = await fetch(`${new URL(req.url).origin}/api/group/members`, {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      }).catch(() => null);
      if (gm?.ok) {
        const data = (await gm.json().catch(() => null)) as { ok?: boolean; members?: Array<{ providers?: string[] }> } | null;
        const arr = (data?.members ?? []).map((m) => (Array.isArray(m.providers) ? m.providers : []));
        if (arr.length > 0) groupProviders = arr;
      }
    }

    const myProviders = new Set(profile.providers ?? []);

    // Slutscore V3
    type ScoredV3 = {
      id: number;
      type: MediaType;
      base: TMDBListItem;
      scoreV3: number;
      kwSet: Set<number>;
      genSet: Set<number>;
      providers: string[];
    };
    const scoredV3: ScoredV3[] = [];
    for (const s of scoredV1.slice(0, N)) {
      const f = featureCache.get(`${s.type}:${s.id}:${locale}`) ?? { keywords: [], people: [] };
      const prov = providersCache.get(`${s.type}:${s.id}`) ?? [];
      let v = s.scoreV1 + scoreTaste(f);

      if (groupCode && groupProviders.length > 0) {
        let covered = 0;
        for (const gp of groupProviders) {
          const gpSet = new Set(gp);
          if (prov.some((p) => gpSet.has(p))) covered++;
        }
        const coverage = covered / groupProviders.length;
        if (coverage === 0) v -= 1.2;
        else v += 1.5 * coverage;
      } else {
        const overlap = prov.some((p) => myProviders.has(p));
        v += overlap ? 0.9 : -0.9;
      }

      scoredV3.push({
        id: s.id,
        type: s.type,
        base: s.base,
        scoreV3: v,
        kwSet: new Set((f.keywords ?? []) as number[]),
        genSet: new Set((s.base.genre_ids ?? []) as number[]),
        providers: prov,
      });
    }

    // Diversifiering (MMR)
    const lambda = 0.3;
    const K = Math.min(100, scoredV3.length);
    const selected: ScoredV3[] = [];
    const pool = [...scoredV3].sort((a, b) => b.scoreV3 - a.scoreV3);

    while (selected.length < K && pool.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;
      for (let i = 0; i < pool.length; i++) {
        const cand = pool[i];
        let sim = 0;
        for (const s of selected) {
          const a = cand.kwSet.size ? cand.kwSet : cand.genSet;
          const b = s.kwSet.size ? s.kwSet : s.genSet;
          sim = Math.max(sim, jaccard(a, b));
        }
        const mmr = cand.scoreV3 - lambda * sim;
        if (mmr > bestScore) {
          bestScore = mmr;
          bestIdx = i;
        }
      }
      selected.push(pool[bestIdx]);
      pool.splice(bestIdx, 1);
    }

    const items: UnifiedItem[] = selected.map((s) => ({
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
    console.error("unified recs V3 error:", err);
    return fail("Internt fel vid rekommendation.");
  }
}
