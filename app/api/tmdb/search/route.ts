// app/api/tmdb/search/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MediaType = "movie" | "tv";

interface TMDBResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const type = (searchParams.get("type") as MediaType) || "movie";
    const lang = searchParams.get("language") || "sv-SE";
    const region = searchParams.get("region") || "SE";
    if (!q) return NextResponse.json({ ok: true, results: [] });

    const url = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(
      q
    )}&include_adult=false&language=${lang}&region=${region}&page=1`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: text }, { status: res.status });
    }

    const data = (await res.json()) as { results: TMDBResult[] };
    const results = (data.results || []).slice(0, 8).map((it) => ({
      id: it.id,
      title: it.title ?? it.name ?? "",
      year: (it.release_date ?? it.first_air_date ?? "").slice(0, 4),
      poster: it.poster_path ? `https://image.tmdb.org/t/p/w185${it.poster_path}` : null,
    }));

    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
