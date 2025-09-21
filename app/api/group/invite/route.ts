// app/api/group/invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const jar = await cookies();

  try {
    const body = (await req.json()) as Partial<{ toUserId: string; code?: string }>;
    const code = body.code ?? jar.get("nw_group")?.value;
    const fromUserId = jar.get("nw_uid")?.value;
    const toUserId = body.toUserId;

    if (!code || !fromUserId || !toUserId) {
      return NextResponse.json({ ok: false, message: "Bad request." }, { status: 200 });
    }

    // spärr: max 1 invite/minut till samma person i samma grupp
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const recent = await prisma.groupInvite.findFirst({
      where: {
        groupCode: code,
        fromUserId,
        toUserId,
        createdAt: { gte: oneMinuteAgo },
        status: "pending",
      },
      select: { id: true },
    });
    if (recent) {
      return NextResponse.json({ ok: false, message: "Too many requests." }, { status: 200 });
    }

    const created = await prisma.groupInvite.create({
      data: {
        groupCode: code,
        fromUserId,
        toUserId,
        status: "pending",
      },
      select: { id: true, status: true },
    });

    return NextResponse.json({ ok: true, inviteId: created.id, status: created.status }, { status: 200 });
  } catch (e) {
    console.error("invite POST error:", e);
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 200 });
  }
}
