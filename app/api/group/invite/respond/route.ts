import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ok = { ok: true; joined?: string; declined?: boolean };
type Err = { ok: false; message: string };
type Body = { id: string; action: "accept" | "decline" };

async function cleanup(): Promise<void> {
  // rensa utgånget
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

    // 1) Hämta inviten
    const invite = await prisma.groupInvite.findUnique({
      where: { id },
    });

    if (!invite) {
      return NextResponse.json({ ok: false, message: "Invite not found." }, { status: 404 });
    }

    // 2) Säkerställ att den är till rätt användare
    if (invite.toUserId !== uid) {
      return NextResponse.json({ ok: false, message: "Invite does not belong to you." }, { status: 403 });
    }

    // 3) Måste vara pending
    if (invite.status !== "pending") {
      return NextResponse.json({ ok: false, message: "Invite is not pending." }, { status: 409 });
    }

    // 4) TTL?
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      await prisma.groupInvite.delete({ where: { id: invite.id } });
      return NextResponse.json({ ok: false, message: "Invite expired." }, { status: 410 });
    }

    // 5) Gruppen måste finnas
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
      return NextResponse.json({ ok: true, declined: true });
    }

    // accept:
    // 6) Lägg till mottagaren i gruppen om inte redan medlem
    await prisma.groupMember.upsert({
      where: { groupCode_userId: { groupCode: invite.groupCode, userId: uid } },
      create: { groupCode: invite.groupCode, userId: uid },
      update: {},
    });

    // 7) Markera inviten accepterad
    await prisma.groupInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", respondedAt: new Date() },
    });

    return NextResponse.json({ ok: true, joined: invite.groupCode });
  } catch (e) {
    // Prisma-specifika koder vi förväntar oss ibland
    const code = (e as { code?: string } | null)?.code;
    if (code === "P2002") {
      // unik-konflikt (t.ex. samtidigt upsert) → behandla som redan löst
      return NextResponse.json({ ok: true }, { status: 200 });
    }
    console.error("invite respond failed", e);
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
