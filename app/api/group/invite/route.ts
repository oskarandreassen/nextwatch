// app/api/group/invite/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Body = { toUserId?: string };

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const me = cookieStore.get("nw_uid")?.value ?? "";
    const activeCode = cookieStore.get("nw_group")?.value ?? "";

    if (!me) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });
    if (!activeCode) return NextResponse.json({ ok: false, message: "No active group." }, { status: 400 });

    const body = (await req.json()) as Body;
    const toUserId = body?.toUserId ?? "";
    if (!toUserId) return NextResponse.json({ ok: false, message: "Missing toUserId." }, { status: 400 });
    if (toUserId === me) return NextResponse.json({ ok: false, message: "Cannot invite yourself." }, { status: 400 });

    // Avsändare måste vara medlem i gruppen
    const meMember = await prisma.groupMember.findFirst({
      where: { groupCode: activeCode, userId: me },
      select: { userId: true },
    });
    if (!meMember) return NextResponse.json({ ok: false, message: "Not a member of active group." }, { status: 403 });

    // Mottagaren får inte redan vara i samma grupp
    const targetAlreadyInGroup = await prisma.groupMember.findFirst({
      where: { groupCode: activeCode, userId: toUserId },
      select: { userId: true },
    });
    if (targetAlreadyInGroup) {
      return NextResponse.json({ ok: false, message: "User is already in the group." }, { status: 400 });
    }

    // Måste vara vänner
    const areFriends = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: me, friendId: toUserId },
          { userId: toUserId, friendId: me },
        ],
      },
      select: { userId: true },
    });
    if (!areFriends) return NextResponse.json({ ok: false, message: "You can only invite friends." }, { status: 403 });

    // Throttle: 1/min
    const since = new Date(Date.now() - 60 * 1000);
    const tooSoon = await prisma.groupInvite.findFirst({
      where: { fromUserId: me, toUserId, createdAt: { gt: since } },
      select: { id: true },
    });
    if (tooSoon) {
      return NextResponse.json({ ok: false, message: "Please wait before inviting again." }, { status: 429 });
    }

    // Redan pending?
    const existing = await prisma.groupInvite.findFirst({
      where: { fromUserId: me, toUserId, status: "pending" },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, requestId: existing.id, message: "Already pending." });
    }

    const created = await prisma.groupInvite.create({
      data: {
        groupCode: activeCode,
        fromUserId: me,
        toUserId,
        status: "pending",
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, requestId: created.id });
  } catch {
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
