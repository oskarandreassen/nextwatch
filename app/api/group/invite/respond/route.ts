// app/api/group/invite/respond/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const jar = await cookies();

  try {
    const userId = jar.get("nw_uid")?.value;
    if (!userId) return NextResponse.json({ ok: false, message: "Not logged in." }, { status: 200 });

    const body = (await req.json()) as Partial<{ inviteId: string; action: "accept" | "decline" }>;
    const inviteId = body.inviteId;
    const action = body.action;

    if (!inviteId || (action !== "accept" && action !== "decline")) {
      return NextResponse.json({ ok: false, message: "Bad request." }, { status: 200 });
    }

    // läs invite + säkerställ att mottagaren är den som svarar
    const inv = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
      select: { id: true, groupCode: true, toUserId: true, status: true },
    });
    if (!inv || inv.toUserId !== userId || inv.status !== "pending") {
      return NextResponse.json({ ok: false, message: "Invite not found." }, { status: 200 });
    }

    if (action === "decline") {
      await prisma.groupInvite.update({
        where: { id: inviteId },
        data: { status: "declined", respondedAt: new Date() },
      });
      return NextResponse.json({ ok: true, status: "declined" }, { status: 200 });
    }

    // accept
    await prisma.$transaction(async (tx) => {
      await tx.groupInvite.update({
        where: { id: inviteId },
        data: { status: "accepted", respondedAt: new Date() },
      });

      // in i gruppen om inte redan medlem
      const exists = await tx.groupMember.findUnique({
        where: { groupCode_userId: { groupCode: inv.groupCode, userId } },
        select: { userId: true },
      });
      if (!exists) {
        await tx.groupMember.create({
          data: { groupCode: inv.groupCode, userId },
        });
      }
    });

    return NextResponse.json({ ok: true, status: "accepted" }, { status: 200 });
  } catch (e) {
    console.error("invite respond POST error:", e);
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 200 });
  }
}
