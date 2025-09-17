// app/api/recs/unified/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import prisma from "@/lib/prisma";

/** ------ Types ------ */
type MediaKind = "movie" | "tv";

type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number | null;
};
type ProvidersResp = { results?: Provider[] };

type DiscoverResult = {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  popularity?: number;
};
type DiscoverResp = {
  page: number;
  results: DiscoverResult[];
  total_pages: number;
  total_results: number;
};

type SimpleItem = {
  id: number;
  tmdbType: MediaKind;
  title: string;
  year?: string;
  poster_path?: string | null;
  vote_average?: number;
};

/** ------ TMDB utils ------ */
const TMDB_BASE = "https://api.themoviedb.org/3";

function normalizeLang(l: string | null): string {
  if (!l) return "sv-SE";
  const first = l.split(",")[0]?.trim();
  return first && /^[a-z]{2}(-[A-Z]{2})?$/.test(first) ? first : "sv-SE";
}
function regionFromLocale(l: string): string {
  const m = l.match(/-([A-Z]{2})$/);
  return m?.[1] ?? "SE";
}
function normProviderName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function intersectProviderNames(listOfLists: string[][]): string[] {
  if (listOfLists.length === 0) return [];
  let acc = new Set(listOfLists[0].map(normProviderName));
  for (let i = 1; i < listOfLists.length; i += 1) {
    const cur = new Set(listOfLists[i].map(normProviderName));
    acc = new Set([...acc].filter((x) => cur.has(x)));
    if (acc.size === 0) break;
  }
  return [...acc];
}
function unionProviderNames(listOfLists: string[][]): string[] {
  const acc = new Set<string>();
  for (const arr of listOfLists) for (const p of arr) acc.add(normProviderName(p));
  return [...acc];
}
function simplify(type: MediaKind, items: DiscoverResult[]): SimpleItem[] {
  return items.map((r) => {
    const title = (type === "movie" ? r.title : r.name) ?? "Okänd titel";
    const d = type === "movie" ? r.release_date : r.first_air_date;
    const year = d && d.length >= 4 ? d.slice(0, 4) : undefined;
    return {
      id: r.id,
      tmdbType: type,
      title,
      year,
      poster_path: r.poster_path ?? null,
      vote_average: r.vote_average,
    };
  });
}

async function tmdbGet<T>(path: string, qs: string): Promise<T> {
  const v4 = process.env.TMDB_v4_TOKEN;
  const v3 = process.env.TMDB_API_KEY;
  const url = `${TMDB_BASE}${path}${qs ? `?${qs}` : ""}`;

  const headersObj: Record<string, string> = {};
  if (v4) headersObj.Authorization = `Bearer ${v4}`;

  const res = await fetch(v4 ? url : `${url}${qs ? "&" : "?"}api_key=${v3 ?? ""}`, {
    headers: headersObj,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return (await res.json()) as T;
}

/** ------ Route ------ */
export async function GET(req: NextRequest) {
  try {
    const jar = await cookies();
    const hdr = await headers();

    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });

    const u = new URL(req.url);
    const pageRaw = u.searchParams.get("page");
    const page = pageRaw && !Number.isNaN(Number(pageRaw)) ? Math.max(1, Number(pageRaw)) : 1;

    const language = normalizeLang(jar.get("nw_locale")?.value ?? hdr.get("accept-language"));
    const region = jar.get("nw_region")?.value ?? regionFromLocale(language);

    const maybeCode = (jar.get("nw_group")?.value ?? "").trim().toUpperCase();
    const hasGroup = maybeCode.length >= 4;

    let providerNamesNorm: string[] = [];
    let strictProviders = false;

    if (hasGroup) {
      // Verifiera medlemskap och samla providers från alla medlemmar
      const memberRows = await prisma.groupMember.findMany({
        where: { groupCode: maybeCode },
        select: { user: { select: { profile: { select: { providers: true } } } } },
        orderBy: { joinedAt: "asc" },
        take: 100,
      });
      const memberProviders: string[][] = memberRows.map((m) => {
        const p = m.user.profile?.providers;
        return Array.isArray(p) ? (p as unknown[]).filter((x): x is string => typeof x === "string") : [];
        // eslint-disable-next-line no-else-return
      });

      const providerNamesAll = memberProviders.filter((arr) => arr.length > 0);
      let norm = intersectProviderNames(providerNamesAll);
      strictProviders = true;
      if (norm.length === 0) {
        norm = unionProviderNames(providerNamesAll);
        strictProviders = false;
      }
      providerNamesNorm = norm;
    } else {
      // Individuell användare → hämta providers från profil
      const prof = await prisma.profile.findUnique({
        where: { userId: uid },
        select: { providers: true },
      });
      const arr = Array.isArray(prof?.providers)
        ? (prof?.providers as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
      providerNamesNorm = arr.map(normProviderName);
      strictProviders = false;
    }

    // Hämta providers-katalog för region och mappa namn -> id
    const [provMovie, provTv] = await Promise.all([
      tmdbGet<ProvidersResp>("/watch/providers/movie", `language=${encodeURIComponent(language)}&watch_region=${encodeURIComponent(region)}`),
      tmdbGet<ProvidersResp>("/watch/providers/tv", `language=${encodeURIComponent(language)}&watch_region=${encodeURIComponent(region)}`),
    ]);
    const nameToId = new Map<string, number>();
    for (const src of [provMovie.results ?? [], provTv.results ?? []]) {
      for (const p of src) {
        const k = normProviderName(p.provider_name);
        if (!nameToId.has(k)) nameToId.set(k, p.provider_id);
      }
    }
    const providerIds = providerNamesNorm
      .map((n) => nameToId.get(n))
      .filter((v): v is number => typeof v === "number");

    const providerParam = providerIds.length > 0 ? providerIds.join("|") : null;

    // Bygg discover-frågor
    const common = [
      `language=${encodeURIComponent(language)}`,
      "include_adult=false",
      `watch_region=${encodeURIComponent(region)}`,
      "sort_by=popularity.desc",
      `page=${page}`,
      "with_watch_monetization_types=flatrate,ads,free",
    ];
    if (providerParam) common.push(`with_watch_providers=${encodeURIComponent(providerParam)}`);

    const [disMovie, disTv] = await Promise.all([
      tmdbGet<DiscoverResp>("/discover/movie", common.join("&")),
      tmdbGet<DiscoverResp>("/discover/tv", common.join("&")),
    ]);

    const itemsMovie = simplify("movie", disMovie.results);
    const itemsTv = simplify("tv", disTv.results);

    // enkel interleave för variation
    const combined: SimpleItem[] = [];
    const maxLen = Math.max(itemsMovie.length, itemsTv.length);
    for (let i = 0; i < maxLen; i += 1) {
      if (i < itemsMovie.length) combined.push(itemsMovie[i]);
      if (i < itemsTv.length) combined.push(itemsTv[i]);
    }

    return NextResponse.json(
      {
        ok: true,
        mode: hasGroup ? "group" : "individual",
        group: hasGroup ? { code: maybeCode, strictProviders } : null,
        language,
        region,
        usedProviderIds: providerIds,
        items: combined,
      },
      { status: 200 }
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[recs/unified] error:", e);
    return NextResponse.json({ ok: true, items: [] as never[] }, { status: 200 });
  }
}
