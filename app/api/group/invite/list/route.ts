// app/api/group/invite/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const me = cookieStore.get("nw_uid")?.value ?? "";
    if (!me) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

    const invites = await prisma.groupInvite.findMany({
      where: { toUserId: me, status: "pending" },
      include: {
        group: { select: { code: true } },
        fromUser: {
          select: { id: true, username: true, profile: { select: { displayName: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      ok: true,
      invites: invites.map((i) => ({
        id: i.id,
        groupCode: i.group.code,
        from: {
          id: i.fromUser.id,
          username: i.fromUser.username,
          displayName: i.fromUser.profile?.displayName ?? null,
        },
        createdAt: i.createdAt,
      })),
    });
  } catch {
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
