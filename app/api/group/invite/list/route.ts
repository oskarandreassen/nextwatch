// app/api/group/invite/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type InviteItem = {
  id: string;
  groupCode: string;
  status: string;
  createdAt: string;
  from?: { id: string; displayName?: string | null; username?: string | null };
  to?: { id: string; displayName?: string | null; username?: string | null };
};

export async function GET(_req: NextRequest) {
  const jar = await cookies();

  try {
    const userId = jar.get("nw_uid")?.value;
    if (!userId) {
      return NextResponse.json({ ok: false, message: "Not logged in." }, { status: 200 });
    }

    // inkommande
    const incomingRaw = await prisma.groupInvite.findMany({
      where: { toUserId: userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: { select: { id: true, profile: { select: { displayName: true } }, username: true } },
      },
    });

    // utgående
    const outgoingRaw = await prisma.groupInvite.findMany({
      where: { fromUserId: userId, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        toUser: { select: { id: true, profile: { select: { displayName: true } }, username: true } },
      },
    });

    const incoming: InviteItem[] = incomingRaw.map((row) => ({
      id: row.id,
      groupCode: row.groupCode,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      from: {
        id: row.fromUser.id,
        displayName: row.fromUser.profile?.displayName ?? null,
        username: row.fromUser.username ?? null,
      },
    }));

    const outgoing: InviteItem[] = outgoingRaw.map((row) => ({
      id: row.id,
      groupCode: row.groupCode,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      to: {
        id: row.toUser.id,
        displayName: row.toUser.profile?.displayName ?? null,
        username: row.toUser.username ?? null,
      },
    }));

    return NextResponse.json({ ok: true, incoming, outgoing }, { status: 200 });
  } catch (e) {
    console.error("invite list GET error:", e);
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 200 });
  }
}
