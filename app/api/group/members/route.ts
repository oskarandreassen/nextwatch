// app/api/group/members/route.ts
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, error: "missing code" }, { status: 400 });

  const members = await prisma.groupMember.findMany({
    where: { groupCode: code },
    select: { userId: true, joinedAt: true, user: { select: { profile: { select: { displayName: true } } } } },
    orderBy: { joinedAt: "asc" },
  });

  const enriched = members.map((m) => {
    const displayName = m.user?.profile?.displayName || "User";
    const initials =
      displayName
        .split(/\s+/)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("")
        .slice(0, 2) || "U";
    return { userId: m.userId, joinedAt: m.joinedAt.toISOString(), displayName, initials };
  });

  return NextResponse.json({ ok: true, code, members: enriched });
}
