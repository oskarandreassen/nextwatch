import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

type TMDbItem = { id:number; title?:string; name?:string; popularity?:number };
type DiscoverResp = { results?: TMDbItem[] };

function ageFromDob(dobStr: string) {
  const dob = new Date(dobStr);
  if (isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// SE-cert nivå vi tillåter givet ålder
function seMaxCert(age: number) {
  if (age >= 15) return "15";
  if (age >= 11) return "11";
  if (age >= 7) return "7";
  // “barntillåten” antas som 0 (TMDb kan sakna explicit 0; vi fall back: utan filter)
  return "0";
}

async function discover(kind: "movie"|"tv", page: number, language: string, region: string, certMax: string) {
  const params = new URLSearchParams({
    include_adult: "false",
    language,
    region,
    sort_by: "popularity.desc",
    page: String(page),
    certification_country: "SE",
    "certification.lte": certMax
  });

  const res = await fetch(`${TMDB_BASE}/discover/${kind}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` },
    next: { revalidate: 60 }
  });

  // Om TMDb inte stödjer filtret för denna kombination → prova utan cert-filter
  if (!res.ok) {
    const fallback = await fetch(
      `${TMDB_BASE}/discover/${kind}?include_adult=false&language=${language}&region=${region}&sort_by=popularity.desc&page=${page}`,
      { headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` }, next: { revalidate: 60 } }
    );
    const data = (await fallback.json()) as DiscoverResp;
    return { usedFilter: false, items: (data.results ?? []).slice(0, 20) };
  }

  const data = (await res.json()) as DiscoverResp;
  // Om filter ger helt tomt (kan hända för “0”) → fallback
  if (!data.results || data.results.length === 0) {
    const fb = await fetch(
      `${TMDB_BASE}/discover/${kind}?include_adult=false&language=${language}&region=${region}&sort_by=popularity.desc&page=${page}`,
      { headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` }, next: { revalidate: 60 } }
    );
    const fbData = (await fb.json()) as DiscoverResp;
    return { usedFilter: false, items: (fbData.results ?? []).slice(0, 20) };
  }

  return { usedFilter: true, items: data.results.slice(0, 20) };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dob = url.searchParams.get("dob");            // YYYY-MM-DD
  const media = (url.searchParams.get("media") || "movie").toLowerCase() as "movie"|"tv";
  const page = Number(url.searchParams.get("page") || "1");
  const language = process.env.DEFAULT_LANGUAGE || "sv-SE";
  const region = process.env.DEFAULT_REGION || "SE";

  if (!dob) return NextResponse.json({ ok:false, error:"Missing dob (YYYY-MM-DD)" }, { status: 400 });
  const age = ageFromDob(dob);
  if (age == null || age < 0 || age > 120) {
    return NextResponse.json({ ok:false, error:"Bad dob" }, { status: 400 });
  }

  const certMax = seMaxCert(age);
  const { usedFilter, items } = await discover(media, page, language, region, certMax);

  const sample = items.slice(0, 10).map(i => ({
    tmdbId: i.id,
    mediaType: media,
    title: i.title ?? i.name ?? "",
    popularity: i.popularity ?? null
  }));

  return NextResponse.json({
    ok: true,
    age,
    region,
    media,
    certMax,          // "0" | "7" | "11" | "15"
    usedFilter,       // false = TMDb saknade stöd/blev tomt → vi föll tillbaka
    count: items.length,
    sample
  });
}
