import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

type Item = { id: number; title?: string; name?: string; popularity?: number; mediaType: "movie"|"tv" };
type DiscoverResp = { results?: Array<{ id:number; title?:string; name?:string; popularity?:number }> };
type ProviderEntry = { provider_id:number; provider_name:string };
type ProvidersSE = { flatrate?: ProviderEntry[] } | null;

const SYNONYMS: Record<string,string[]> = {
  "Amazon Prime Video": ["Prime Video"],
  "Apple TV+": ["Apple TV Plus"]
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

async function discover(kind: "movie"|"tv", page: number, language: string, region: string): Promise<Item[]> {
  const url = `${TMDB_BASE}/discover/${kind}?include_adult=false&language=${language}&region=${region}&sort_by=popularity.desc&page=${page}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` },
    next: { revalidate: 60 }
  });
  if (!res.ok) throw new Error(`discover ${kind}: ${res.status}`);
  const data = (await res.json()) as DiscoverResp;
  return (data.results ?? []).map(r => ({
    id: r.id, title: r.title, name: r.name, popularity: r.popularity, mediaType: kind
  }));
}

async function providers(kind: "movie"|"tv", id: number, region: string): Promise<ProvidersSE> {
  const url = `${TMDB_BASE}/${kind}/${id}/watch/providers`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` },
    next: { revalidate: 600 }
  });
  if (!res.ok) return null;
  const data = await res.json() as { results?: Record<string, ProvidersSE> };
  return data.results?.[region] ?? null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mediaParam = (url.searchParams.get("media") || "both").toLowerCase(); // movie|tv|both
  const page = Number(url.searchParams.get("page") || "1");
  const region = process.env.DEFAULT_REGION || "SE";
  const language = process.env.DEFAULT_LANGUAGE || "sv-SE";
  const limit = Math.min(Number(url.searchParams.get("limit") || "20"), 50);
  const includeUnknown = (url.searchParams.get("includeUnknown") || "false").toLowerCase() === "true";

  const allowedParam = url.searchParams.get("allowed") || ""; // kommaseparerade namn
  const allowedList = allowedParam
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const allowed = expandAllowed(allowedList);

  // Hämta kandidater
  const items: Item[] = [];
  if (mediaParam === "movie" || mediaParam === "both") {
    items.push(...await discover("movie", page, language, region));
  }
  if (mediaParam === "tv" || mediaParam === "both") {
    items.push(...await discover("tv", page, language, region));
  }

  // Begränsa hur många vi kollar providers på (för hastighet)
  const CHECK_CAP = Math.min(items.length, 40);
  const subset = items.slice(0, CHECK_CAP);

  const results: Array<{
    tmdbId:number; mediaType:"movie"|"tv"; title:string; matchedProviders:string[]; unknown:boolean;
  }> = [];

  // Kör i små batcher för att undvika rate-limit
  const BATCH = 6;
  for (let i = 0; i < subset.length && results.length < limit; i += BATCH) {
    const batch = subset.slice(i, i + BATCH);
    const provs = await Promise.all(batch.map(it => providers(it.mediaType, it.id, region)));

    for (let j = 0; j < batch.length && results.length < limit; j++) {
      const it = batch[j];
      const se = provs[j];
      const names = (se?.flatrate ?? []).map(p => p.provider_name);
      const normalized = names.map(norm);
      const hasMatch = allowed.size > 0 ? normalized.some(n => allowed.has(n)) : normalized.length > 0;

      const unknown = !se || (se && !se.flatrate);
      if ( (allowed.size > 0 && hasMatch) || (allowed.size === 0 && (unknown ? includeUnknown : true)) ) {
        const title = it.title ?? it.name ?? "";
        const matched = names.filter(n => allowed.has(norm(n)));
        results.push({ tmdbId: it.id, mediaType: it.mediaType, title, matchedProviders: matched, unknown });
      } else if (includeUnknown && unknown && allowed.size > 0 === false) {
        // (edge-fall: includeUnknown används bara när allowed saknas)
        const title = it.title ?? it.name ?? "";
        results.push({ tmdbId: it.id, mediaType: it.mediaType, title, matchedProviders: [], unknown: true });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    region,
    page,
    limit,
    requestedAllowed: allowedList,
    found: results.length,
    results
  });
}
