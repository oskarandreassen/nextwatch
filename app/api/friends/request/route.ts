// app/api/friends/request/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import crypto from "node:crypto";

type Body = {
  userId?: string;
  username?: string;
};

type Status = "PENDING_OUT" | "ACCEPTED";

function normalizeUsername(u: string | undefined): string | null {
  if (!u) return null;
  const s = u.trim().toLowerCase();
  if (s.length < 3 || s.length > 20) return null;
  if (!/^[a-z0-9_]+$/.test(s)) return null;
  return s;
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) {
    return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });
  }

  const body = (await req.json()) as Body;
  const userId = typeof body.userId === "string" && body.userId.trim() !== "" ? body.userId : null;
  const username = normalizeUsername(body.username);

  if (!userId && !username) {
    return NextResponse.json({ ok: false, message: "userId eller username krävs." }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: userId ? { id: userId } : { username: username! },
    select: { id: true, username: true },
  });

  if (!target) {
    return NextResponse.json({ ok: false, message: "Användaren hittades inte." }, { status: 404 });
  }
  if (target.id === uid) {
    return NextResponse.json({ ok: false, message: "Du kan inte lägga till dig själv." }, { status: 400 });
  }

  // Finns relation redan i någon riktning?
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: uid, addresseeId: target.id },
        { requesterId: target.id, addresseeId: uid },
      ],
    },
    select: { id: true, requesterId: true, addresseeId: true, status: true },
  });

  if (existing) {
    if (existing.status === "ACCEPTED") {
      return NextResponse.json({ ok: true, status: "ACCEPTED" as Status });
    }
    if (existing.status === "PENDING") {
      // Om den andra redan skickat förfrågan till mig → auto-accept
      if (existing.requesterId === target.id && existing.addresseeId === uid) {
        await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: "ACCEPTED" },
        });
        return NextResponse.json({ ok: true, status: "ACCEPTED" as Status });
      }
      // Jag har redan en pending ut → returnera PENDING_OUT
      return NextResponse.json({ ok: true, status: "PENDING_OUT" as Status });
    }
    if (existing.status === "BLOCKED") {
      return NextResponse.json({ ok: false, message: "Relation blockerad." }, { status: 403 });
    }
  }

  // Skapa ny pending-förfrågan
  await prisma.friendship.create({
    data: {
      id: crypto.randomUUID(),
      requesterId: uid,
      addresseeId: target.id,
      status: "PENDING",
    },
  });

  return NextResponse.json({ ok: true, status: "PENDING_OUT" as Status }, { status: 200 });
}
