import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

type TMDbItem = { id:number; title?:string; name?:string; popularity?:number };
type DiscoverResp = { results?: TMDbItem[] };
type ProviderEntry = { provider_id:number; provider_name:string };
type ProvidersSE = { flatrate?: ProviderEntry[] } | null;

function ageFromDob(dobStr: string) {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}
function seMaxCert(age: number) {
  if (age >= 15) return "15";
  if (age >= 11) return "11";
  if (age >= 7) return "7";
  return "0";
}

const SYNONYMS: Record<string,string[]> = {
  "Amazon Prime Video": ["Prime Video"],
  "Apple TV+": ["Apple TV Plus", "Apple TV+"]
};
function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/\+/g, "plus").trim();
}
function expandAllowed(raw: string[]): Set<string> {
  const out = new Set<string>();
  for (const r of raw) {
    out.add(norm(r));
    const syns = SYNONYMS[r] ?? [];
    for (const s of syns) out.add(norm(s));
  }
  return out;
}

async function discover(kind: "movie"|"tv", page: number, language: string, region: string, certMax?: string) {
  // Försök med cert-filter om vi har ett max; annars standarddiscover
  if (certMax) {
    const params = new URLSearchParams({
      include_adult: "false",
      language, region,
      sort_by: "popularity.desc",
      page: String(page),
      certification_country: "SE",
      "certification.lte": certMax
    });
    const res = await fetch(`${TMDB_BASE}/discover/${kind}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` },
      next: { revalidate: 60 }
    });
    if (res.ok) {
      const data = (await res.json()) as DiscoverResp;
      if (data.results && data.results.length > 0) {
        return { usedFilter: true, items: data.results };
      }
    }
  }
  // Fallback: utan cert-filter
  const url = `${TMDB_BASE}/discover/${kind}?include_adult=false&language=${language}&region=${region}&sort_by=popularity.desc&page=${page}`;
  const fb = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` },
    next: { revalidate: 60 }
  });
  const fbData = (await fb.json()) as DiscoverResp;
  return { usedFilter: false, items: fbData.results ?? [] };
}

async function providers(kind: "movie"|"tv", id: number, region: string): Promise<ProvidersSE> {
  const res = await fetch(`${TMDB_BASE}/${kind}/${id}/watch/providers`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` },
    next: { revalidate: 600 }
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Record<string, ProvidersSE> };
  return data.results?.[region] ?? null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mediaParam = (url.searchParams.get("media") || "both").toLowerCase() as "movie"|"tv"|"both";
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
  const includeUnknown = (url.searchParams.get("includeUnknown") || "false").toLowerCase() === "true";
  const dob = url.searchParams.get("dob"); // YYYY-MM-DD
  const allowedParam = url.searchParams.get("allowed") || ""; // kommaseparerade namn
  const allowedList = allowedParam.split(",").map(s => s.trim()).filter(Boolean);
  const allowed = expandAllowed(allowedList);

  const language = process.env.DEFAULT_LANGUAGE || "sv-SE";
  const region = process.env.DEFAULT_REGION || "SE";

  let certMax: string | undefined;
  let age: number | null = null;
  if (dob) {
    age = ageFromDob(dob);
    if (age !== null && age >= 0 && age <= 120) certMax = seMaxCert(age);
  }

  // Kandidater
  const items: Array<{ id:number; title:string; mediaType:"movie"|"tv"; popularity:number|null }> = [];
  const used: { movie?: boolean; tv?: boolean } = {};
  if (mediaParam === "movie" || mediaParam === "both") {
    const d = await discover("movie", page, language, region, certMax);
    used.movie = d.usedFilter;
    for (const r of d.items) items.push({ id: r.id, title: r.title ?? r.name ?? "", mediaType: "movie", popularity: r.popularity ?? null });
  }
  if (mediaParam === "tv" || mediaParam === "both") {
    const d = await discover("tv", page, language, region, certMax);
    used.tv = d.usedFilter;
    for (const r of d.items) items.push({ id: r.id, title: r.title ?? r.name ?? "", mediaType: "tv", popularity: r.popularity ?? null });
  }

  // Providerfilter
  const CHECK_CAP = Math.min(items.length, 40);
  const subset = items.slice(0, CHECK_CAP);
  const results: Array<{ tmdbId:number; mediaType:"movie"|"tv"; title:string; matchedProviders:string[]; unknown:boolean }> = [];

  const BATCH = 6;
  for (let i = 0; i < subset.length && results.length < limit; i += BATCH) {
    const batch = subset.slice(i, i + BATCH);
    const provs = await Promise.all(batch.map(it => providers(it.mediaType, it.id, region)));
    for (let j = 0; j < batch.length && results.length < limit; j++) {
      const it = batch[j];
      const se = provs[j];
      const names = (se?.flatrate ?? []).map(p => p.provider_name);
      const normalized = names.map(norm);
      const unknown = !se || !se.flatrate;
      const hasMatch = allowed.size > 0 ? normalized.some(n => allowed.has(n)) : normalized.length > 0;

      if ((allowed.size > 0 && hasMatch) || (allowed.size === 0 && (unknown ? includeUnknown : true))) {
        results.push({ tmdbId: it.id, mediaType: it.mediaType, title: it.title, matchedProviders: names.filter(n => allowed.has(norm(n))), unknown });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    region, language,
    media: mediaParam,
    page, limit,
    age,
    certMax: certMax ?? null,
    usedCertFilter: used,
    requestedAllowed: allowedList,
    found: results.length,
    results
  });
}
