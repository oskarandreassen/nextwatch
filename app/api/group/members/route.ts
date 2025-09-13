// app/api/group/members/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code") || "";
    if (!code) return NextResponse.json({ ok: false, error: "Missing ?code" }, { status: 400 });

    const group = await prisma.group.findUnique({ where: { code } });
    if (!group) return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });

    const members = await prisma.groupMember.findMany({
      where: { groupCode: code },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });

    const norm = members.map((m) => {
      const email = m.user.email ?? "";
      const displayBase = email ? email.split("@")[0] : `User-${m.userId.slice(0, 6)}`;
      const displayName = displayBase.charAt(0).toUpperCase() + displayBase.slice(1);
      const initials = displayName
        .split(/\s+/)
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      return {
        userId: m.userId,
        displayName,
        initials,
        joinedAt: m.joinedAt.toISOString(),
      };
    });

    return NextResponse.json({ ok: true, members: norm });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
