import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ok = { ok: true; joined?: string; declined?: boolean };
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
    const body = (await req.json()) as unknown;

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Body).id !== "string" ||
      !["accept", "decline"].includes((body as Body).action as string)
    ) {
      return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
    }

    const { id, action } = body as Body;

    if (!uid) {
      return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });
    }

    await cleanup();

    const invite = await prisma.groupInvite.findUnique({ where: { id } });
    if (!invite) return NextResponse.json({ ok: false, message: "Invite not found." }, { status: 404 });
    if (invite.toUserId !== uid) {
      return NextResponse.json({ ok: false, message: "Invite does not belong to you." }, { status: 403 });
    }
    if (invite.status !== "pending") {
      // inte pending längre – behandla som redan hanterad
      if (action === "accept") {
        // säkra medlemskap ändå
        await prisma.groupMember.upsert({
          where: { groupCode_userId: { groupCode: invite.groupCode, userId: uid } },
          create: { groupCode: invite.groupCode, userId: uid },
          update: {},
        });
        return NextResponse.json({ ok: true, joined: invite.groupCode });
      }
      return NextResponse.json({ ok: true, declined: true });
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      await prisma.groupInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ ok: false, message: "Invite expired." }, { status: 410 });
    }

    const group = await prisma.group.findUnique({ where: { code: invite.groupCode } });
    if (!group) {
      await prisma.groupInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ ok: false, message: "Group gone." }, { status: 410 });
    }

    if (action === "decline") {
      try {
        await prisma.groupInvite.update({
          where: { id: invite.id },
          data: { status: "declined", respondedAt: new Date() },
        });
      } catch {
        // ignoreras – kan vara P2002 från tidigare declined
      }
      return NextResponse.json({ ok: true, declined: true });
    }

    // ACCEPT
    // 1) säkra medlemskap
    await prisma.groupMember.upsert({
      where: { groupCode_userId: { groupCode: invite.groupCode, userId: uid } },
      create: { groupCode: invite.groupCode, userId: uid },
      update: {},
    });

    // 2) markera invite accepterad – om P2002 pga gammal accepted, fortsätt ändå
    try {
      await prisma.groupInvite.update({
        where: { id: invite.id },
        data: { status: "accepted", respondedAt: new Date() },
      });
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      if (code !== "P2002") {
        // okänt fel – men försök ändå returnera joined
        console.error("invite respond update failed", e);
      }
      // Vid P2002: ignorerar – vi har redan lagt in membership
    }

    return NextResponse.json({ ok: true, joined: invite.groupCode });
  } catch (e) {
    console.error("invite respond failed", e);
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
