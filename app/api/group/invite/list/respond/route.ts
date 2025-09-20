// app/api/group/invite/respond/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Body = { inviteId?: string; action?: "accept" | "decline" };

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const me = cookieStore.get("nw_uid")?.value ?? "";
    if (!me) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

    const body = (await req.json()) as Body;
    const inviteId = body?.inviteId ?? "";
    const action = body?.action ?? "decline";
    if (!inviteId) return NextResponse.json({ ok: false, message: "Missing inviteId." }, { status: 400 });

    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
      include: { group: true },
    });
    if (!invite || invite.toUserId !== me || invite.status !== "pending") {
      return NextResponse.json({ ok: false, message: "Invite not found." }, { status: 404 });
    }

    if (action === "accept") {
      // Markera accepterad
      await prisma.groupInvite.update({
        where: { id: inviteId },
        data: { status: "accepted", respondedAt: new Date() },
      });

      // Lämna ev. andra grupper och gå med i denna
      await prisma.groupMember.deleteMany({ where: { userId: me, NOT: { groupCode: invite.groupCode } } });
      await prisma.groupMember.upsert({
        where: { groupCode_userId: { groupCode: invite.groupCode, userId: me } },
        create: { groupCode: invite.groupCode, userId: me },
        update: {},
      });

      const res = NextResponse.json({ ok: true, joined: invite.groupCode });
      // Sätt aktiv grupp-cookie
      res.cookies.set({
        name: "nw_group",
        value: invite.groupCode,
        path: "/",
      });
      return res;
    }

    // decline
    await prisma.groupInvite.update({
      where: { id: inviteId },
      data: { status: "declined", respondedAt: new Date() },
    });

    return NextResponse.json({ ok: true, declined: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
