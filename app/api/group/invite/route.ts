// app/api/group/invite/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type InviteBody = {
  groupCode: string;
  toUserId: string;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: NextRequest) {
  try {
    // NOTE: cookies() är async i din Next-version
    const cookieStore = await cookies();
    const fromUserId = cookieStore.get("nw_uid")?.value ?? null;
    if (!fromUserId) return bad("Unauthorized.", 401);

    const body = (await req.json()) as Partial<InviteBody>;
    const groupCode = (body.groupCode ?? "").trim();
    const toUserId = (body.toUserId ?? "").trim();

    if (!groupCode || !toUserId) return bad("Missing groupCode or toUserId.");
    if (toUserId === fromUserId) return bad("Cannot add yourself.");

    // 1) Är avsändaren medlem i gruppen?
    const meInGroup = await prisma.groupMember.findUnique({
      where: { groupCode_userId: { groupCode, userId: fromUserId } },
      select: { groupCode: true },
    });
    if (!meInGroup) return bad("You are not a member of this group.", 403);

    // 2) Finns mottagaren?
    const targetUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true },
    });
    if (!targetUser) return bad("User not found.", 404);

    // 3) Redan medlem?
    const targetInGroup = await prisma.groupMember.findUnique({
      where: { groupCode_userId: { groupCode, userId: toUserId } },
      select: { userId: true },
    });
    if (targetInGroup) return bad("User is already a group member.");

    // 4) Rate-limit: 1/min för samma trio (group, from, to) när pending
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const recentPending = await prisma.groupInvite.findFirst({
      where: {
        groupCode,
        fromUserId,
        toUserId,
        status: "pending",
        createdAt: { gte: oneMinuteAgo },
      },
      select: { id: true },
    });
    if (recentPending) {
      return bad("You can only send one invite per minute to this user for this group.");
    }

    // 5) Finns redan en pending?
    const existingPending = await prisma.groupInvite.findFirst({
      where: { groupCode, fromUserId, toUserId, status: "pending" },
      select: { id: true },
    });
    if (existingPending) return bad("Invite already pending.");

    // 6) Skapa invite
    const inv = await prisma.groupInvite.create({
      data: {
        groupCode,
        fromUserId,
        toUserId,
        status: "pending",
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, id: inv.id, createdAt: inv.createdAt });
  } catch (err) {
    console.error("invite POST failed", err);
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
