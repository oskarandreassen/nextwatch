// app/api/watchlist/remove/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

type Body = { tmdbId: number; mediaType: "movie" | "tv" };

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  try {
    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (!uid) return bad("Ingen session (nw_uid saknas).", 401);

    const body = (await req.json()) as Body;
    const tmdbId = Number(body.tmdbId);
    const mediaType = body.mediaType;

    if (!Number.isFinite(tmdbId) || tmdbId <= 0) return bad("Ogiltigt tmdbId.");
    if (mediaType !== "movie" && mediaType !== "tv") return bad("Ogiltig mediaType.");

    // Rå SQL så vi slipper ev. Prisma-fältnamnsskillnader
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.watchlist WHERE user_id = $1 AND tmdb_id = $2 AND media_type = $3;`,
      uid,
      tmdbId,
      mediaType
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("watchlist/remove error:", err);
    return NextResponse.json({ ok: false, message: "Kunde inte ta bort titel från watchlist." }, { status: 500 });
  }
}
