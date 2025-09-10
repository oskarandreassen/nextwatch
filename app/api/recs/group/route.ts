import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ---- TMDb typer ---- */
type TMDbItem = { id: number; title?: string; name?: string; popularity?: number };
type DiscoverResp = { results?: TMDbItem[] };
type ProviderEntry = { provider_id: number; provider_name: string };
type ProvidersSE = { flatrate?: ProviderEntry[] } | null;

/** ---- Feed typer ---- */
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

/** ---- Hjälpfunktioner ---- */
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
function normProvName(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/\+/g, "plus").trim();
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

/** ---- Grupp-aware recs ---- */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code")?.trim();
    if (!code) return NextResponse.json({ ok: false, error: "missing code" }, { status: 400 });

    const media = (url.searchParams.get("media") || "both").toLowerCase() as
      | "movie"
      | "tv"
      | "both";
    const pageStart = Number(url.searchParams.get("page") || "1");
    const limit = Math.min(Number(url.searchParams.get("limit") || "30"), 150);
    const pagesToFetch = Math.min(Number(url.searchParams.get("pages") || "3"), 5);

    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok: false, error: "no cookie" }, { status: 400 });

    // Grupp + medlemmar
    const [grp, members] = await Promise.all([
      prisma.group.findUnique({ where: { code } }),
      prisma.groupMember.findMany({ where: { groupCode: code } }),
    ]);
    if (!grp) return NextResponse.json({ ok: false, error: "group not found" }, { status: 404 });

    // Hämta profiler för alla medlemmar (vi behöver providers + ålder/region/språk)
    const userIds = members.map((m) => m.userId);
    const profiles = await prisma.profile.findMany({
      where: { userId: { in: userIds } },
    });
    if (profiles.length === 0)
      return NextResponse.json({ ok: false, error: "no profiles in group" }, { status: 400 });

    // Ålder → certMax: ta högsta gemensamma gräns (minsta certMax)
    const ages = profiles.map((p) => ageFromDob(new Date(p.dob)));
    const certMax = seMaxCert(Math.min(...ages));

    // Region/språk: ta majoritet eller defaulta till SE/sv-SE
    const region =
      profiles
        .map((p) => p.region)
        .filter(Boolean)
        .sort((a, b) => profiles.filter((p) => p.region === b).length - profiles.filter((p) => p.region === a).length)[0] ?? "SE";
    const language =
      profiles
        .map((p) => p.locale)
        .filter(Boolean)
        .sort((a, b) => profiles.filter((p) => p.locale === b).length - profiles.filter((p) => p.locale === a).length)[0] ??
      "sv-SE";

    // Provider-intersektion: endast tjänster som ALLA i gruppen har valt
    const providerSets = profiles.map((p) =>
      new Set(
        (Array.isArray(p.providers) ? (p.providers as unknown as string[]) : []).map(normProvName)
      )
    );
    let allowed = new Set<string>();
    if (providerSets.length > 0) {
      // börja med första, intersecta sen
      allowed = new Set(providerSets[0]);
      for (let i = 1; i < providerSets.length; i++) {
        const nxt = new Set<string>();
        for (const s of allowed) if (providerSets[i].has(s)) nxt.add(s);
        allowed = nxt;
      }
    }

    // Samla items över flera sidor
    const items: Array<{
      id: number;
      title: string;
      mediaType: "movie" | "tv";
      popularity: number | null;
    }> = [];

    async function collect(kind: "movie" | "tv") {
      for (let p = pageStart; p < pageStart + pagesToFetch; p++) {
        const d = await discover(kind, p, language, region, certMax);
        for (const r of d) {
          items.push({
            id: r.id,
            title: r.title ?? r.name ?? "",
            mediaType: kind,
            popularity: r.popularity ?? null,
          });
          if (items.length >= 300) return;
        }
      }
    }

    if (media === "movie" || media === "both") await collect("movie");
    if (media === "tv" || media === "both") await collect("tv");

    items.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    const subset = items.slice(0, 160);

    const recs: RecItem[] = [];
    for (let i = 0; i < subset.length && recs.length < limit; i += 8) {
      const batch = subset.slice(i, i + 8);
      const provs = await Promise.all(batch.map((it) => providers(it.mediaType, it.id, region)));
      for (let j = 0; j < batch.length && recs.length < limit; j++) {
        const it = batch[j];
        const se = provs[j];
        const names = (se?.flatrate ?? []).map((p) => p.provider_name);
        const norm = names.map(normProvName);
        const unknown = !se || !se.flatrate;

        // Om ingen i gruppen valt providers (allowed.size=0) → visa allt som har någon provider
        const has = allowed.size > 0 ? norm.some((n) => allowed.has(n)) : norm.length > 0;

        if (has) {
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
    }

    // Ads: styrs av plan för den som gör anropet (enkelt MVP)
    const me = await prisma.user.findUnique({ where: { id: uid } });
    const hasLifetime = (me?.plan ?? "free") === "lifetime";

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

    return NextResponse.json({
      ok: true,
      code,
      count: feed.length,
      certMax,
      region,
      language,
      feed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
