import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TMDB_BASE = "https://api.themoviedb.org/3";

export async function GET(req: Request) {
  const token = process.env.TMDB_V4_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing TMDB_V4_TOKEN" }, { status: 500 });
  }

  const url = new URL(req.url);
  const media = (url.searchParams.get("media") || "movie").toLowerCase(); // "movie" | "tv"
  const page = url.searchParams.get("page") || "1";
  const language = process.env.DEFAULT_LANGUAGE || "sv-SE";
  const region = process.env.DEFAULT_REGION || "SE";
  const endpoint = media === "tv" ? "discover/tv" : "discover/movie";

  const res = await fetch(
    `${TMDB_BASE}/${endpoint}?include_adult=false&language=${language}&region=${region}&sort_by=popularity.desc&page=${page}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 60 }
    }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ ok: false, status: res.status, body: text.slice(0, 500) }, { status: res.status });
  }

  const data = await res.json();
  const sample = (data.results ?? []).slice(0, 5).map((x: any) => ({
    tmdbId: x.id,
    mediaType: media === "tv" ? "tv" : "movie",
    title: x.title || x.name,
    popularity: x.popularity ?? null
  }));

  return NextResponse.json({ ok: true, count: data.results?.length ?? 0, sample });
}
