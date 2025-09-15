// app/api/swipe/decide/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Decision = "like" | "dislike";

type Body = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  decision: Decision;
};

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) {
    return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const { tmdbId, mediaType, decision } = body;

  if (!tmdbId || !mediaType || (decision !== "like" && decision !== "dislike")) {
    return NextResponse.json({ ok: false, message: "Ogiltig payload." }, { status: 400 });
  }

  // Spara rating
  await prisma.rating.create({
    data: {
      id: crypto.randomUUID(),
      userId: uid,
      tmdbId,
      mediaType,
      decision,
    },
  });

  // Lägg till i watchlist vid "like"
  if (decision === "like") {
    await prisma.watchlist.upsert({
      where: { userId_tmdbId_mediaType: { userId: uid, tmdbId, mediaType } },
      update: {},
      create: {
        id: crypto.randomUUID(),
        userId: uid,
        tmdbId,
        mediaType,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
