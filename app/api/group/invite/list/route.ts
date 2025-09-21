// app/api/group/invite/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // NOTE: cookies() är async i din Next-version
    const cookieStore = await cookies();
    const uid = cookieStore.get("nw_uid")?.value ?? null;
    if (!uid) {
      return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
    }

    // INCOMING (till mig, pending)
    const incomingRaw = await prisma.groupInvite.findMany({
      where: { toUserId: uid, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    const incoming = incomingRaw.map((i) => ({
      id: i.id,
      groupCode: i.groupCode,
      status: i.status,
      createdAt: i.createdAt,
      from: {
        id: i.fromUser.id,
        displayName: i.fromUser.profile?.displayName ?? null,
        username: i.fromUser.username,
      },
    }));

    // OUTGOING (från mig, pending)
    const outgoingRaw = await prisma.groupInvite.findMany({
      where: { fromUserId: uid, status: "pending" },
      orderBy: { createdAt: "desc" },
      include: {
        toUser: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    });

    const outgoing = outgoingRaw.map((i) => ({
      id: i.id,
      groupCode: i.groupCode,
      status: i.status,
      createdAt: i.createdAt,
      to: {
        id: i.toUser.id,
        displayName: i.toUser.profile?.displayName ?? null,
        username: i.toUser.username,
      },
    }));

    return NextResponse.json({ ok: true, incoming, outgoing });
  } catch (err) {
    console.error("invite list GET failed", err);
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
