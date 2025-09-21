// app/api/group/votes/progress/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ok = {
  ok: true;
  code: string;
  tmdbId: number;
  tmdbType: "movie" | "tv";
  size: number;      // antal medlemmar i gruppen
  need: number;      // likes som krävs (ceil(0.6*size), min 2)
  likes: number;     // antal LIKE
  dislikes: number;  // antal DISLIKE
  matched: boolean;  // true om likes >= need och dislikes === 0
};

type Err = { ok: false; error: string };

function needThreshold(size: number): number {
  if (size <= 2) return 2;
  return Math.ceil(0.6 * size);
}

export async function GET(req: Request) {
  await cookies();
  try {
    const u = new URL(req.url);
    const code = (u.searchParams.get("code") || "").toUpperCase();
    const tmdbId = Number(u.searchParams.get("tmdbId") || "");
    const tmdbType = (u.searchParams.get("tmdbType") || "").toLowerCase() as "movie" | "tv";

    if (!code || !tmdbId || (tmdbType !== "movie" && tmdbType !== "tv")) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid code/tmdbId/tmdbType" } as Err,
        { status: 400 },
      );
    }

    const members = await prisma.groupMember.findMany({
      where: { groupCode: code },
      select: { userId: true },
    });
    const size = members.length;
    const need = needThreshold(size);

    const agg = await prisma.groupVote.groupBy({
      by: ["vote"],
      where: { groupCode: code, tmdbId, tmdbType },
      _count: { vote: true },
    });

    const likes = agg.find((a) => a.vote === "LIKE")?._count.vote ?? 0;
    const dislikes = agg.find((a) => a.vote === "DISLIKE")?._count.vote ?? 0;

    const matched = size > 0 && likes >= need && dislikes === 0;

    const ok: Ok = {
      ok: true,
      code,
      tmdbId,
      tmdbType,
      size,
      need,
      likes,
      dislikes,
      matched,
    };
    return NextResponse.json(ok);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg } as Err, { status: 500 });
  }
}
