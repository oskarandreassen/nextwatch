import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TMDbItem = { id: number; title?: string; name?: string; popularity?: number };
type DiscoverResp = { results?: TMDbItem[] };
type ProviderEntry = { provider_id: number; provider_name: string };
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

type FeedItem = RecItem | AdItem;

const TMDB = "https://api.themoviedb.org/3";
const H = { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` };

function ageFromDob(d: Date) {
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}
function seMaxCert(age: number) {
  if (age >= 15) return "15";
  if (age >= 11) return "11";
  if (age >= 7) return "7";
  return "0";
}

async function discover(
  kind: "movie" | "tv",
  page: number,
  language: string,
  region: string,
  certMax?: string
) {
  const base = new URLSearchParams({
    include_adult: "false",
    language,
    region,
    sort_by: "popularity.desc",
    page: String(page),
  });
  const url = certMax
    ? `${TMDB}/discover/${kind}?${base}&certification_country=SE&certification.lte=${certMax}`
    : `${TMDB}/discover/${kind}?${base}`;
  const r = await fetch(url, { headers: H, next: { revalidate: 60 } });
  const d = (await r.json()) as DiscoverResp;
  return d.results ?? [];
}
async function providers(kind: "movie" | "tv", id: number, region: string): Promise<ProvidersSE> {
  const r = await fetch(`${TMDB}/${kind}/${id}/watch/providers`, {
    headers: H,
    next: { revalidate: 600 },
  });
  if (!r.ok) return null;
  const d = (await r.json()) as { results?: Record<string, ProvidersSE> };
  return d.results?.[region] ?? null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const media = (url.searchParams.get("media") || "both").toLowerCase() as
      | "movie"
      | "tv"
      | "both";
    const page = Number(url.searchParams.get("page") || "1");
    const limit = Math.min(Number(url.searchParams.get("limit") || "30"), 150);

    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok: false, error: "no cookie" }, { status: 400 });

    const [user, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: uid } }),
      prisma.profile.findUnique({ where: { userId: uid } }),
    ]);
    if (!profile) return NextResponse.json({ ok: false, error: "no profile" }, { status: 400 });

    const age = ageFromDob(new Date(profile.dob));
    const certMax = seMaxCert(age);
    const region = profile.region ?? "SE";
    const language = profile.locale ?? "sv-SE";
    const allowed = new Set(
      (Array.isArray(profile.providers) ? (profile.providers as unknown as string[]) : [])
        .map((s) => s.toLowerCase().replace(/\s+/g, " ").replace(/\+/g, "plus").trim())
    );

    const items: Array<{
      id: number;
      title: string;
      mediaType: "movie" | "tv";
      popularity: number | null;
    }> = [];
    if (media === "movie" || media === "both") {
      const d = await discover("movie", page, language, region, certMax);
      for (const r of d)
        items.push({
          id: r.id,
          title: r.title ?? r.name ?? "",
          mediaType: "movie",
          popularity: r.popularity ?? null,
        });
    }
    if (media === "tv" || media === "both") {
      const d = await discover("tv", page, language, region, certMax);
      for (const r of d)
        items.push({
          id: r.id,
          title: r.title ?? r.name ?? "",
          mediaType: "tv",
          popularity: r.popularity ?? null,
        });
    }

    const subset = items.slice(0, 80);
    const recs: RecItem[] = [];

    for (let i = 0; i < subset.length && recs.length < limit; i += 8) {
      const batch = subset.slice(i, i + 8);
      const provs = await Promise.all(batch.map((it) => providers(it.mediaType, it.id, region)));
      for (let j = 0; j < batch.length && recs.length < limit; j++) {
        const it = batch[j];
        const se = provs[j];
        const names = (se?.flatrate ?? []).map((p) => p.provider_name);
        const norm = names
          .map((n) => n.toLowerCase().replace(/\s+/g, " ").replace(/\+/g, "plus").trim());
        const unknown = !se || !se.flatrate;
        const has = allowed.size > 0 ? norm.some((n) => allowed.has(n)) : norm.length > 0;
        if (has)
          recs.push({
            type: "rec",
            tmdbId: it.id,
            mediaType: it.mediaType,
            title: it.title,
            matchedProviders: names,
            unknown,
          });
      }
    }

    // ads i gratis
    const hasLifetime = (user?.plan ?? "free") === "lifetime";
    const adEvery = 12;
    const feed: FeedItem[] = [];
    if (hasLifetime) {
      feed.push(...recs);
    } else {
      recs.forEach((r, idx) => {
        if (idx > 0 && idx % adEvery === 0) {
          const ad: AdItem = {
            type: "ad",
            id: `house-${idx / adEvery}`,
            headline: "Uppgradera till Premium",
            body: "Större grupper, inga annonser.",
            cta: "Köp lifetime",
            href: "/premium",
          };
          feed.push(ad);
        }
        feed.push(r);
      });
    }

    return NextResponse.json({ ok: true, count: feed.length, hasLifetime, certMax, feed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
