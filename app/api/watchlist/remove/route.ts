// app/api/watchlist/remove/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let prisma: PrismaClient | undefined;
function getPrisma() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

type Body = {
  tmdbId: number;
  mediaType: "movie" | "tv";
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}
function ok(payload: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...payload });
}

export async function POST(req: Request) {
  try {
    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (!uid) return bad("Ingen session hittades (nw_uid saknas).", 401);

    const body = (await req.json()) as Body;
    const tmdbId = Number(body.tmdbId);
    const mediaType = body.mediaType;

    if (!Number.isFinite(tmdbId) || (mediaType !== "movie" && mediaType !== "tv")) {
      return bad("Ogiltig payload.");
    }

    const db = getPrisma();

    const existing = await db.watchlist.findFirst({
      where: { userId: uid, tmdbId, mediaType },
      select: { id: true },
    });

    if (existing) {
      await db.watchlist.delete({ where: { id: existing.id } });
    }

    return ok();
  } catch (err) {
    console.error("watchlist/remove error", err);
    return bad("Prisma-fel.", 500);
  }
}
