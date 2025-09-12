// app/api/group/members/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code")?.toUpperCase() || "";
  if (!code) return NextResponse.json({ ok: false, error: "Missing ?code" }, { status: 400 });

  const members = await prisma.groupMember.findMany({
    where: { groupCode: code },
    select: { userId: true, joinedAt: true, user: { select: { id: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const profiles = await prisma.profile.findMany({
    where: { userId: { in: members.map((m) => m.userId) } },
    select: { userId: true, displayName: true },
  });
  const map = new Map(profiles.map((p) => [p.userId, p.displayName || null]));

  const list = members.map((m) => {
    const name = map.get(m.userId);
    return {
      userId: m.userId,
      displayName: name || `User ${m.userId.slice(0, 6)}`,
      initials: (name || m.userId).split(/\s+/).map(s => s[0]?.toUpperCase() || "").join("").slice(0, 2),
      joinedAt: m.joinedAt,
    };
  });

  return NextResponse.json({ ok: true, members: list });
}
