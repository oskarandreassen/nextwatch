import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TMDB = "https://api.themoviedb.org/3";
const H = { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` };

type MovieDetails = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date?: string | null;
};
type TvDetails = {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  first_air_date?: string | null;
};
type NormalizedDetails = {
  ok: true;
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterUrl: string | null;
  year: string | null;
};

function posterUrl(path: string | null | undefined): string | null {
  return path ? `https://image.tmdb.org/t/p/w500${path}` : null;
}
function yearFromDate(d?: string | null): string | null {
  if (!d) return null;
  const y = d.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "").toLowerCase() as "movie" | "tv";
    const id = Number(url.searchParams.get("id") || "");
    if (!type || !id || !Number.isFinite(id)) {
      return NextResponse.json({ ok: false, error: "missing or invalid type/id" }, { status: 400 });
    }

    // Försök läsa språk/region från användarprofil
    const c = await cookies();
    const uid = c.get("nw_uid")?.value || null;
    let language = "sv-SE";
    let region = "SE";
    if (uid) {
      const profile = await prisma.profile.findUnique({ where: { userId: uid } });
      if (profile?.locale) language = profile.locale;
      if (profile?.region) region = profile.region;
    }

    const q = new URLSearchParams({ language, region });
    const r = await fetch(`${TMDB}/${type}/${id}?${q.toString()}`, {
      headers: H,
      next: { revalidate: 3600 },
    });
    if (!r.ok) {
      return NextResponse.json(
        { ok: false, error: `tmdb ${r.status}` },
        { status: 502 }
      );
    }

    if (type === "movie") {
      const d = (await r.json()) as MovieDetails;
      const res: NormalizedDetails = {
        ok: true,
        id: d.id,
        mediaType: "movie",
        title: d.title,
        overview: d.overview || "",
        posterUrl: posterUrl(d.poster_path),
        year: yearFromDate(d.release_date ?? null),
      };
      return NextResponse.json(res);
    } else {
      const d = (await r.json()) as TvDetails;
      const res: NormalizedDetails = {
        ok: true,
        id: d.id,
        mediaType: "tv",
        title: d.name,
        overview: d.overview || "",
        posterUrl: posterUrl(d.poster_path),
        year: yearFromDate(d.first_air_date ?? null),
      };
      return NextResponse.json(res);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
