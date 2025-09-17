// app/api/friends/accept/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Ok = { ok: true; friendship?: { userId: string; friendId: string } };
type Err = { ok: false; message: string };

function json(status: number, body: Ok | Err) {
  return NextResponse.json(body, { status });
}

type Body = {
  // Acceptera genom ett specifikt friend_request-id (uuid från DB)
  requestId?: string;
  // Alternativ: acceptera pending request från given avsändare
  fromUserId?: string;
  // Alternativ: acceptera pending request från given avsändares username
  fromUsername?: string;
};

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return json(401, { ok: false, message: "Ingen session." });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { ok: false, message: "Ogiltig JSON." });
  }

  const { requestId, fromUserId, fromUsername } = body;
  if (!requestId && !fromUserId && !fromUsername) {
    return json(400, {
      ok: false,
      message: "Ange 'requestId' eller 'fromUserId' eller 'fromUsername'.",
    });
  }

  // Hitta pending friend request riktad till inloggad användare
  // 1) via requestId
  // 2) via fromUserId -> uid
  // 3) via fromUsername -> uid
  const pending = await (async () => {
    if (requestId) {
      return prisma.friendRequest.findFirst({
        where: { id: requestId, toUserId: uid, status: "pending" },
        select: { id: true, fromUserId: true, toUserId: true, status: true },
      });
    }
    if (fromUserId) {
      return prisma.friendRequest.findFirst({
        where: { fromUserId, toUserId: uid, status: "pending" },
        select: { id: true, fromUserId: true, toUserId: true, status: true },
      });
    }
    // fromUsername
    const user =
      (await prisma.user.findFirst({
        where: { username: fromUsername ?? "" },
        select: { id: true },
      })) ?? null;
    if (!user) return null;
    return prisma.friendRequest.findFirst({
      where: { fromUserId: user.id, toUserId: uid, status: "pending" },
      select: { id: true, fromUserId: true, toUserId: true, status: true },
    });
  })();

  if (!pending) {
    return json(404, { ok: false, message: "Ingen väntande förfrågan hittades." });
  }

  // Markera som accepterad
  await prisma.friendRequest.update({
    where: { id: pending.id },
    data: { status: "accepted", decidedAt: new Date() },
  });

  // Skapa vänskap i kanonisk ordning (min, max) → undviker dubbletter
  const a = pending.fromUserId < pending.toUserId ? pending.fromUserId : pending.toUserId;
  const b = pending.fromUserId < pending.toUserId ? pending.toUserId : pending.fromUserId;

  try {
    // @@id([userId, friendId]) → kompositnyckel 'userId_friendId'
    await prisma.friendship.upsert({
      where: { userId_friendId: { userId: a, friendId: b } },
      create: { userId: a, friendId: b },
      update: {},
    });
  } catch (e) {
    // Om det redan finns i omvänd ordning och DB har LEAST/GREATEST-unik index kan upsert kasta → ignorera
    // (Vi vill inte att UI/funktionalitet påverkas av race/dubblett)
  }

  return json(200, { ok: true, friendship: { userId: a, friendId: b } });
}
