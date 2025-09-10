import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TMDbItem = { id:number; title?:string; name?:string; popularity?:number };
type DiscoverResp = { results?: TMDbItem[] };
type ProviderEntry = { provider_id:number; provider_name:string };
type ProvidersSE = { flatrate?: ProviderEntry[] } | null;

type RecItem = {
  type: "rec";
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  matchedProviders: string[];
  unknown: boolean;
};

type AdItem = {
  type: "ad";
  id: string;
  headline: string;
  body: string;
  cta: string;
  href: string;
};

const TMDB_BASE = "https://api.themoviedb.org/3";

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

async function discover(kind: "movie"|"tv", page: number, language: string, region: string, certMax?: string) {
  if (certMax) {
    const params = new URLSearchParams({
      include_adult:"false", language, region, sort_by:"popularity.desc",
      page:String(page), certification_country:"SE", "certification.lte":certMax
    });
    const res = await fetch(`${TMDB_BASE}/discover/${kind}?${params}`, {
      headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` }, next: { revalidate: 60 }
    });
    if (res.ok) {
      const data = (await res.json()) as DiscoverResp;
      if (data.results?.length) return data.results;
    }
  }
  const fb = await fetch(
    `${TMDB_BASE}/discover/${kind}?include_adult=false&language=${language}&region=${region}&sort_by=popularity.desc&page=${page}`,
    { headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` }, next: { revalidate: 60 } }
  );
  const fbData = (await fb.json()) as DiscoverResp;
  return fbData.results ?? [];
}

async function providers(kind: "movie"|"tv", id: number, region: string): Promise<ProvidersSE> {
  const res = await fetch(`${TMDB_BASE}/${kind}/${id}/watch/providers`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` }, next: { revalidate: 600 }
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Record<string, ProvidersSE> };
  return data.results?.[region] ?? null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = (url.searchParams.get("code") || "").toUpperCase();
    const media = (url.searchParams.get("media") || "both").toLowerCase() as "movie"|"tv"|"both";
    const page = Number(url.searchParams.get("page") || "1");
    const limitBase = Math.min(Number(url.searchParams.get("limit") || "30"), 150);

    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status:400 });
    if (!code) return NextResponse.json({ ok:false, error:"missing code" }, { status:400 });

    const grp = await prisma.group.findUnique({ where:{ code } });
    if (!grp) return NextResponse.json({ ok:false, error:"not found" }, { status:404 });

    const members = await prisma.groupMember.findMany({ where:{ groupCode: code } });
    const ids = members.map(m=>m.userId);
    const profiles = await prisma.profile.findMany({ where:{ userId: { in: ids } } });
    const users = await prisma.user.findMany({ where:{ id: { in: ids } } });

    // intersektion providers
    const lists = profiles.map(p => Array.isArray(p.providers) ? (p.providers as unknown as string[]) : []);
    const intersection = lists.length ? lists.reduce((acc,arr)=>acc.filter(x=>arr.includes(x))) : [];

    // strängaste cert (yngst)
    const minAge = profiles.length ? Math.min(...profiles.map(p => ageFromDob(new Date(p.dob)))) : 18;
    const certMax = seMaxCert(minAge);

    // språk/region (ta första profilens, fallback SE/sv-SE)
    const region = profiles[0]?.region ?? "SE";
    const language = profiles[0]?.locale ?? "sv-SE";

    // kandidater
    const items: Array<{ id:number; title:string; mediaType:"movie"|"tv"; popularity:number|null }> = [];
    if (media === "movie" || media === "both") {
      const d = await discover("movie", page, language, region, certMax);
      for (const r of d) items.push({ id: r.id, title: r.title ?? r.name ?? "", mediaType:"movie", popularity: r.popularity ?? null });
    }
    if (media === "tv" || media === "both") {
      const d = await discover("tv", page, language, region, certMax);
      for (const r of d) items.push({ id: r.id, title: r.title ?? r.name ?? "", mediaType:"tv", popularity: r.popularity ?? null });
    }

    // providerfilter med TMDb
    const CHECK_CAP = Math.min(items.length, 80);
    const subset = items.slice(0, CHECK_CAP);
    const recs: RecItem[] = [];

    const allowed = new Set(intersection.map(s => s.toLowerCase().replace(/\s+/g," ").replace(/\+/g,"plus").trim()));

    const BATCH = 8;
    for (let i = 0; i < subset.length && recs.length < limitBase; i += BATCH) {
      const batch = subset.slice(i, i + BATCH);
      const provs = await Promise.all(batch.map(it => providers(it.mediaType, it.id, region)));
      for (let j = 0; j < batch.length && recs.length < limitBase; j++) {
        const it = batch[j];
        const se = provs[j];
        const names = (se?.flatrate ?? []).map(p => p.provider_name);
        const normalized = names.map(n => n.toLowerCase().replace(/\s+/g," ").replace(/\+/g,"plus").trim());
        const unknown = !se || !se.flatrate;
        const hasMatch = allowed.size > 0 ? normalized.some(n => allowed.has(n)) : normalized.length > 0;
        if (hasMatch) {
          recs.push({ type:"rec", tmdbId: it.id, mediaType: it.mediaType, title: it.title, matchedProviders: names, unknown });
        }
      }
    }

    // premium-gating + annonsinjektion
    const hasLifetime = users.some(u => (u.plan ?? "free") === "lifetime");
    const feed: Array<RecItem | AdItem> = [];
    const adEvery = 12;
    if (hasLifetime) {
      feed.push(...recs);
    } else {
      recs.forEach((r, idx) => {
        if (idx > 0 && idx % adEvery === 0) {
          const ad: AdItem = {
            type: "ad",
            id: `house-${idx/adEvery}`,
            headline: "Uppgradera till Premium (lifetime)",
            body: "Större grupper och inga annonser.",
            cta: "Läs mer",
            href: "/premium"
          };
          feed.push(ad);
        }
        feed.push(r);
      });
    }

    return NextResponse.json({
      ok:true,
      code,
      size: ids.length,
      hasLifetime,
      certMax,
      providersIntersection: intersection,
      count: feed.length,
      feed
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok:false, error: msg }, { status:500 });
  }
}
