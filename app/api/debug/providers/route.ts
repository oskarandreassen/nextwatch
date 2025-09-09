import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

type ProviderItem = { provider_id: number; provider_name: string; logo_path?: string };
type ProvidersSE = {
  link?: string;
  flatrate?: ProviderItem[];
  rent?: ProviderItem[];
  buy?: ProviderItem[];
} | null;

export async function GET(req: Request) {
  const token = process.env.TMDB_V4_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing TMDB_V4_TOKEN" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const media = (searchParams.get("media") || "movie").toLowerCase() as "movie" | "tv";
  const idStr = searchParams.get("id");
  const region = process.env.DEFAULT_REGION || "SE";

  if (!idStr) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Bad id" }, { status: 400 });

  const url = `${TMDB_BASE}/${media}/${id}/watch/providers`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 300 }
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ ok: false, status: res.status, body: text.slice(0, 500) }, { status: res.status });
  }

  const data = (await res.json()) as { results?: Record<string, ProvidersSE> };
  const se = data.results?.[region] ?? null;

  const flatrateNames = se?.flatrate?.map(p => p.provider_name) ?? [];

  return NextResponse.json({
    ok: true,
    region,
    hasData: !!se,
    flatrate: se?.flatrate ?? [],
    flatrateNames
  });
}
