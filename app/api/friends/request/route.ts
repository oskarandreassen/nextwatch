// app/api/friends/request/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Err = { ok: false; message: string };
type Ok = { ok: true; requestId: string };

type Body = {
  toUserId?: string;
  toUsername?: string;
};

type IdRow = { id: string };
type ExistsRow = { exists: boolean };
type ReqRow = { id: string };

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." } as Err, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Ogiltig JSON." } as Err, { status: 400 });
  }

  const { toUserId, toUsername } = body;
  if (!toUserId && !toUsername) {
    return NextResponse.json({ ok: false, message: "Ange 'toUserId' eller 'toUsername'." } as Err, { status: 400 });
  }

  // resolve target id
  let targetId: string | null = toUserId ?? null;
  if (!targetId && toUsername) {
    const rows = await prisma.$queryRaw<IdRow[]>`
      SELECT id FROM users WHERE LOWER(username) = LOWER(${toUsername}) LIMIT 1
    `;
    targetId = rows[0]?.id ?? null;
  }

  if (!targetId) {
    return NextResponse.json({ ok: false, message: "Användare hittades inte." } as Err, { status: 404 });
  }
  if (targetId === uid) {
    return NextResponse.json({ ok: false, message: "Du kan inte skicka till dig själv." } as Err, { status: 400 });
  }

  // Redan vänner?
  const a = targetId < uid ? targetId : uid;
  const b = targetId < uid ? uid : targetId;

  const friendExists = await prisma.$queryRaw<ExistsRow[]>`
    SELECT EXISTS(
      SELECT 1 FROM friendships WHERE user_id = ${a} AND friend_id = ${b}
    ) AS exists
  `;
  if (friendExists[0]?.exists) {
    return NextResponse.json({ ok: false, message: "Ni är redan vänner." } as Err, { status: 409 });
  }

  // Pending request redan?
  const pending = await prisma.$queryRaw<ExistsRow[]>`
    SELECT EXISTS(
      SELECT 1
      FROM friend_requests
      WHERE status = 'pending'
        AND (
          (from_user_id = ${uid} AND to_user_id = ${targetId})
          OR
          (from_user_id = ${targetId} AND to_user_id = ${uid})
        )
    ) AS exists
  `;
  if (pending[0]?.exists) {
    return NextResponse.json({ ok: false, message: "Det finns redan en väntande förfrågan." } as Err, { status: 409 });
  }

  // Skapa pending
  const created = await prisma.$queryRaw<ReqRow[]>`
    INSERT INTO friend_requests (id, from_user_id, to_user_id, status, created_at)
    VALUES (gen_random_uuid(), ${uid}, ${targetId}, 'pending', NOW())
    RETURNING id
  `;
  const requestId = created[0]?.id ?? null;
  if (!requestId) {
    return NextResponse.json({ ok: false, message: "Kunde inte skapa förfrågan." } as Err, { status: 500 });
  }

  return NextResponse.json({ ok: true, requestId } as Ok);
}
