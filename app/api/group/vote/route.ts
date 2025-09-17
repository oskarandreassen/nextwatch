// app/api/groups/vote/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import crypto from "node:crypto";

type VoteKind = "LIKE" | "DISLIKE" | "SKIP";
type MediaKind = "movie" | "tv";

type Body = {
  code?: string;
  tmdbId?: number;
  tmdbType?: MediaKind;
  vote?: VoteKind;
};

function isMediaKind(x: string | undefined): x is MediaKind {
  return x === "movie" || x === "tv";
}
function isVoteKind(x: string | undefined): x is VoteKind {
  return x === "LIKE" || x === "DISLIKE" || x === "SKIP";
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });

  const body = (await req.json()) as Body;
  const code = (body.code ?? jar.get("nw_group")?.value ?? "").trim().toUpperCase();
  const tmdbId = typeof body.tmdbId === "number" ? body.tmdbId : NaN;
  const tmdbType = body.tmdbType;
  const vote = body.vote;

  if (code.length < 4) return NextResponse.json({ ok: false, message: "Ogiltig kod." }, { status: 400 });
  if (!Number.isFinite(tmdbId)) return NextResponse.json({ ok: false, message: "Ogiltigt tmdbId." }, { status: 400 });
  if (!isMediaKind(tmdbType)) return NextResponse.json({ ok: false, message: "Ogiltig typ." }, { status: 400 });
  if (!isVoteKind(vote)) return NextResponse.json({ ok: false, message: "Ogiltig röst." }, { status: 400 });

  // Säkerställ att jag är medlem
  const isMember = await prisma.groupMember.findUnique({
    where: { groupCode_userId: { groupCode: code, userId: uid } },
    select: { userId: true },
  });
  if (!isMember) return NextResponse.json({ ok: false, message: "Du är inte medlem i gruppen." }, { status: 403 });

  // Upsert röst
  await prisma.groupVote.upsert({
    where: { groupCode_userId_tmdbId_mediaType: { groupCode: code, userId: uid, tmdbId, mediaType: tmdbType } },
    create: {
      id: crypto.randomUUID(),
      groupCode: code,
      userId: uid,
      tmdbId,
      mediaType: tmdbType,
      vote,
    },
    update: { vote },
  });

  // Räkna röster/tallies
  const [counts, totalMembers] = await Promise.all([
    prisma.groupVote.groupBy({
      by: ["vote"],
      where: { groupCode: code, tmdbId, mediaType: tmdbType },
      _count: { _all: true },
    }),
    prisma.groupMember.count({ where: { groupCode: code } }),
  ]);

  let like = 0;
  let dislike = 0;
  let skip = 0;
  for (const c of counts) {
    if (c.vote === "LIKE") like = c._count._all;
    else if (c.vote === "DISLIKE") dislike = c._count._all;
    else if (c.vote === "SKIP") skip = c._count._all;
  }

  return NextResponse.json(
    {
      ok: true,
      tallies: { like, dislike, skip, total: totalMembers },
    },
    { status: 200 }
  );
}
