import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim();
  const tmdbIdStr = url.searchParams.get("tmdbId");
  if (!code) return NextResponse.json({ ok: false, error: "missing code" }, { status: 400 });

  const members = await prisma.groupMember.findMany({
    where: { groupCode: code },
    select: { userId: true },
  });
  const ids = members.map((m) => m.userId);
  if (ids.length === 0) return NextResponse.json({ ok: true, code, ratings: [] });

  const where: any = { userId: { in: ids } };
  if (tmdbIdStr) where.tmdbId = Number(tmdbIdStr);

  const ratings = await prisma.rating.findMany({
    where,
    select: { userId: true, tmdbId: true, mediaType: true, decision: true, decidedAt: true },
    orderBy: { decidedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ ok: true, code, count: ratings.length, ratings });
}
