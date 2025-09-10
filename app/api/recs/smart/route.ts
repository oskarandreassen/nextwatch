import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TMDbItem = { id:number; title?:string; name?:string; popularity?:number };
type DiscoverResp = { results?: TMDbItem[] };
type ProviderEntry = { provider_id:number; provider_name:string };
type ProvidersSE = { flatrate?: ProviderEntry[] } | null;

const TMDB_BASE = "https://api.themoviedb.org/3";

// Helpers
function ageFromDob(d: Date) {
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
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
  "Apple TV+": ["Apple TV Plus", "Apple TV+"],
};
function norm(s: string) { return s.toLowerCase().replace(/\s+/g," ").replace(/\+/g,"plus").trim(); }
function expandAllowed(raw: string[]): Set<string> {
  const out = new Set<string>();
  for (const r of raw) { out.add(norm(r)); for (const s of (SYNONYMS[r] ?? [])) out.add(norm(s)); }
  return out;
}

async function discover(kind: "movie"|"tv", page: number, language: string, region: string, certMax?: string) {
  // Försök med cert-filter först
  if (certMax) {
    const params = new URLSearchParams({
      include_adult: "false", language, region, sort_by: "popularity.desc",
      page: String(page), certification_country: "SE", "certification.lte": certMax
    });
    const res = await fetch(`${TMDB_BASE}/discover/${kind}?${params}`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` },
      next: { revalidate: 60 }
    });
    if (res.ok) {
      const data = (await res.json()) as DiscoverResp;
      if (data.results?.length) return data.results;
    }
  }
  // Fallback utan cert-filter
  const fb = await fetch(
    `${TMDB_BASE}/discover/${kind}?include_adult=false&language=${language}&region=${region}&sort_by=popularity.desc&page=${page}`,
    { headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` }, next: { revalidate: 60 } }
  );
  const fbData = (await fb.json()) as DiscoverResp;
  return fbData.results ?? [];
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
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status: 400 });

    const url = new URL(req.url);
    const media = (url.searchParams.get("media") || "both").toLowerCase() as "movie"|"tv"|"both";
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Math.min(Number(url.searchParams.get("limit") || "30"), 150);

    const prof = await prisma.profile.findUnique({ where: { userId: uid } });
    if (!prof) return NextResponse.json({ ok:false, error:"no profile" }, { status: 400 });

    const age = ageFromDob(new Date(prof.dob));
    const certMax = seMaxCert(age);
    const allowedList: string[] = Array.isArray(prof.providers) ? (prof.providers as unknown as string[]) : [];
    const allowed = expandAllowed(allowedList);
    const language = prof.locale || process.env.DEFAULT_LANGUAGE || "sv-SE";
    const region = prof.region || process.env.DEFAULT_REGION || "SE";

    // Hämta kandidater (film och/eller tv)
    const items: Array<{ id:number; title:string; mediaType:"movie"|"tv"; popularity:number|null }> = [];
    if (media === "movie" || media === "both") {
      const d = await discover("movie", page, language, region, certMax);
      for (const r of d) items.push({ id: r.id, title: r.title ?? r.name ?? "", mediaType: "movie", popularity: r.popularity ?? null });
    }
    if (media === "tv" || media === "both") {
      const d = await discover("tv", page, language, region, certMax);
      for (const r of d) items.push({ id: r.id, title: r.title ?? r.name ?? "", mediaType: "tv", popularity: r.popularity ?? null });
    }

    // Provider-filter (begränsa antal API-anrop)
    const CHECK_CAP = Math.min(items.length, 80);
    const subset = items.slice(0, CHECK_CAP);
    const results: Array<{ tmdbId:number; mediaType:"movie"|"tv"; title:string; matchedProviders:string[]; unknown:boolean }> = [];

    const BATCH = 8;
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
        if (hasMatch) {
          results.push({ tmdbId: it.id, mediaType: it.mediaType, title: it.title, matchedProviders: names, unknown });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      userId: uid,
      age, certMax, region, language,
      requestedProviders: allowedList,
      found: results.length,
      results
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok:false, error: msg }, { status: 500 });
  }
}
