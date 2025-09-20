// app/api/friends/request/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type ApiOk = { ok: true; requestId: string };
type ApiErr = { ok: false; message: string };

function json(body: ApiOk | ApiErr, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies(); // App Router: alltid await
    const me = cookieStore.get("nw_uid")?.value ?? "";
    if (!me) return json({ ok: false, message: "Not authenticated." }, { status: 401 });

    // Minimal, typad validering utan externa deps
    let toUserId = "";
    try {
      const body = (await req.json()) as unknown;
      if (typeof body === "object" && body && "toUserId" in (body as Record<string, unknown>)) {
        const v = (body as Record<string, unknown>)["toUserId"];
        if (typeof v === "string" && v.trim().length > 0) toUserId = v.trim();
      }
    } catch {
      /* ignore */
    }
    if (!toUserId) return json({ ok: false, message: "toUserId required" }, { status: 400 });
    if (toUserId === me) return json({ ok: false, message: "Cannot add yourself." }, { status: 400 });

    // Båda användarna måste finnas
    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: me }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } }),
    ]);
    if (!fromUser || !toUser) return json({ ok: false, message: "User not found." }, { status: 404 });

    // Redan vänner?
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: me, friendId: toUserId },
          { userId: toUserId, friendId: me },
        ],
      },
      select: { userId: true },
    });
    if (friendship) return json({ ok: true, requestId: "already_friends" });

    // Pending i någon riktning?
    const existing = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { fromUserId: me, toUserId, status: "pending" },
          { fromUserId: toUserId, toUserId: me, status: "pending" },
        ],
      },
      select: { id: true, fromUserId: true, toUserId: true },
    });

    if (existing) {
      // Om motparten redan skickat → auto-accept & skapa friendship
      if (existing.fromUserId === toUserId && existing.toUserId === me) {
        await prisma.$transaction(async (tx) => {
          await tx.friendRequest.update({
            where: { id: existing.id },
            data: { status: "accepted", decidedAt: new Date() },
          });

          // Normalisera ordning i friendships (userId < friendId)
          const a = me < toUserId ? me : toUserId;
          const b = me < toUserId ? toUserId : me;

          await tx.friendship.upsert({
            where: { userId_friendId: { userId: a, friendId: b } },
            update: {},
            create: { userId: a, friendId: b },
          });
        });
      }
      return json({ ok: true, requestId: existing.id });
    }

    // Skapa ny pending (idempotent vid unique-conflict)
    try {
      const fr = await prisma.friendRequest.create({
        data: { fromUserId: me, toUserId, status: "pending" },
        select: { id: true },
      });
      return json({ ok: true, requestId: fr.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate key") || msg.includes("23505")) {
        const fr = await prisma.friendRequest.findFirst({
          where: { fromUserId: me, toUserId, status: "pending" },
          select: { id: true },
        });
        return json({ ok: true, requestId: fr?.id ?? "pending" });
      }
      return json({ ok: false, message: "Internal error." }, { status: 500 });
    }
  } catch {
    return json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
