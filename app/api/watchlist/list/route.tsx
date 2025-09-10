import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = { tmdb_id: number; media_type: "movie" | "tv"; added_at: Date };

export async function GET() {
  const c = await cookies();
  const uid = c.get("nw_uid")?.value || null;
  if (!uid) return NextResponse.json({ ok: false, error: "no cookie" }, { status: 401 });

  // SQL för att undvika schema-glidning
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT tmdb_id, media_type, added_at
    FROM watchlist
    WHERE user_id = ${uid}
    ORDER BY added_at DESC
    LIMIT 100
  `;

  const items = rows.map(r => ({
    tmdbId: Number(r.tmdb_id),
    mediaType: r.media_type,
    addedAt: r.added_at,
  }));

  return NextResponse.json({ ok: true, items });
}
