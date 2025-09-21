import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ok = { ok: true };
type Err = { ok: false; message: string };
type Body = { id: string; action: "accept" | "decline" };

async function cleanup(): Promise<void> {
  await prisma.groupInvite.deleteMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse<Ok | Err>> {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? "";

  try {
    const body = (await req.json()) as Body | unknown;
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Body).id !== "string" ||
      !["accept", "decline"].includes((body as Body).action as string)
    ) {
      return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
    }
    const { id, action } = body as Body;

    await cleanup();

    const invite = await prisma.groupInvite.findUnique({
      where: { id },
    });

    if (!invite || invite.toUserId !== uid) {
      return NextResponse.json({ ok: false, message: "Invite not found." }, { status: 404 });
    }

    // expired?
    if (invite.status === "pending" && invite.expiresAt && invite.expiresAt < new Date()) {
      await prisma.groupInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ ok: false, message: "Invite expired." }, { status: 410 });
    }

    // grupp måste finnas
    const group = await prisma.group.findUnique({ where: { code: invite.groupCode } });
    if (!group) {
      await prisma.groupInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ ok: false, message: "Group gone." }, { status: 410 });
    }

    if (action === "decline") {
      await prisma.groupInvite.update({
        where: { id: invite.id },
        data: { status: "declined", respondedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    // accept
    await prisma.groupMember.upsert({
      where: { groupCode_userId: { groupCode: invite.groupCode, userId: uid } },
      create: { groupCode: invite.groupCode, userId: uid },
      update: {},
    });

    await prisma.groupInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", respondedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
