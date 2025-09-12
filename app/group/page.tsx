import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ok = {
  ok: true;
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  overview: string;
  posterUrl: string | null;
  posterPath: string | null;
  year: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  blurDataURL: string | null;
};
type Err = { ok: false; error: string };

const TMDB = "https://api.themoviedb.org/3";
const H = { Authorization: `Bearer ${process.env.TMDB_V4_TOKEN!}` };

function yearFrom(d?: string | null): string | null {
  if (!d) return null;
  const y = d.slice(0, 4);
  return /^\d{4}$/.test(y) ? y : null;
}
const BLUR_1x1 =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const type = (url.searchParams.get("type") || "").toLowerCase() as "movie" | "tv";
    const id = Number(url.searchParams.get("id") || "");
    if (!id || (type !== "movie" && type !== "tv")) {
      return NextResponse.json<Err>({ ok: false, error: "invalid params" }, { status: 400 });
    }

    // Default region/language; read from profile if present
    let language = "sv-SE";
    let region = "SE";
    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (uid) {
      const p = await prisma.profile.findUnique({ where: { userId: uid } });
      if (p?.locale) language = p.locale;
      if (p?.region) region = p.region;
    }

    const qs = new URLSearchParams({ language, region });
    const r = await fetch(`${TMDB}/${type}/${id}?${qs}`, { headers: H, next: { revalidate: 600 } });
    if (!r.ok) {
      return NextResponse.json<Err>({ ok: false, error: `TMDb ${r.status}` }, { status: 500 });
    }
    const j = (await r.json()) as {
      id: number;
      title?: string;
      name?: string;
      overview?: string;
      poster_path?: string | null;
      vote_average?: number | null;
      vote_count?: number | null;
      release_date?: string | null;
      first_air_date?: string | null;
    };

    const title = j.title ?? j.name ?? "";
    const posterPath = j.poster_path ?? null;
    const payload: Ok = {
      ok: true,
      id: j.id,
      mediaType: type,
      title,
      overview: j.overview ?? "",
      posterUrl: posterPath ? `https://image.tmdb.org/t/p/original${posterPath}` : null,
      posterPath,
      year: type === "movie" ? yearFrom(j.release_date) : yearFrom(j.first_air_date),
      voteAverage: j.vote_average ?? null,
      voteCount: j.vote_count ?? null,
      blurDataURL: BLUR_1x1,
    };
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json<Err>({ ok: false, error: msg }, { status: 500 });
  }
}
