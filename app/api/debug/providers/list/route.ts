import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";
type RawProvider = { provider_id: number; provider_name: string; logo_path?: string; display_priority?: number };
type Catalog = { results?: RawProvider[] };

const WANTED = [
  "Netflix",
  "Disney+",
  "Max",
  "Amazon Prime Video",
  "Viaplay",
  "Apple TV+",
  "TV4 Play",
  "SVT Play"
];

const SYNONYMS: Record<string, string[]> = {
  "Apple TV+": ["Apple TV Plus", "Apple TV+"]
};

function norm(n: string) {
  return n.toLowerCase().replace(/\s+/g, " ").replace(/\+/g, "plus").trim();
}

export async function GET() {
  const token = process.env.TMDB_V4_TOKEN;
  const region = process.env.DEFAULT_REGION || "SE";
  if (!token) return NextResponse.json({ ok: false, error: "Missing TMDB_V4_TOKEN" }, { status: 500 });

  async function fetchKind(kind: "movie" | "tv") {
    const url = `${TMDB_BASE}/watch/providers/${kind}?watch_region=${region}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 3600 }
    });
    if (!res.ok) throw new Error(`${kind} providers: ${res.status}`);
    const data = (await res.json()) as Catalog;
    const list = (data.results ?? []).map(p => ({ id: p.provider_id, name: p.provider_name }));
    return list;
  }

  const [movie, tv] = await Promise.all([fetchKind("movie"), fetchKind("tv")]);

  // Union (per id, fallback name)
  const byId = new Map<number, { id: number; name: string }>();
  const byName = new Map<string, { id: number; name: string }>();
  for (const arr of [movie, tv]) {
    for (const p of arr) {
      if (p.id) byId.set(p.id, p);
      else byName.set(p.name, p);
    }
  }
  const union = [...byId.values(), ...byName.values()];

  // Shortlist: vilka av våra "WANTED" finns?
  const normSet = new Set(union.map(u => norm(u.name)));
  const wantedExpanded = WANTED.flatMap(w =>
    [w, ...(SYNONYMS[w] ?? [])].map(x => ({ label: w, norm: norm(x) }))
  );

  const available: string[] = [];
  const missing: string[] = [];
  for (const w of WANTED) {
    const group = wantedExpanded.filter(x => x.label === w).map(x => x.norm);
    const hit = group.some(g => normSet.has(g));
    (hit ? available : missing).push(w);
  }

  return NextResponse.json({
    ok: true,
    region,
    counts: { movie: movie.length, tv: tv.length, union: union.length },
    movie,
    tv,
    union,
    shortlist: { wanted: WANTED, available, missing }
  });
}
