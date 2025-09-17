// app/api/friends/accept/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Body = {
  requestId?: string;
  requesterId?: string;
  requesterUsername?: string;
};

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
  const byId = typeof body.requestId === "string" && body.requestId.trim().length > 0 ? body.requestId : null;
  const byRequesterId = typeof body.requesterId === "string" && body.requesterId.trim().length > 0 ? body.requesterId : null;
  const byRequesterUsername = normalizeUsername(body.requesterUsername);

  if (!byId && !byRequesterId && !byRequesterUsername) {
    return NextResponse.json({ ok: false, message: "requestId eller requesterId/Username krävs." }, { status: 400 });
  }

  // Hitta pending som riktar sig till mig
  const friendship = byId
    ? await prisma.friendship.findFirst({
        where: { id: byId, addresseeId: uid },
        select: { id: true, status: true },
      })
    : byRequesterId
    ? await prisma.friendship.findFirst({
        where: { requesterId: byRequesterId, addresseeId: uid },
        select: { id: true, status: true },
      })
    : await prisma.friendship.findFirst({
        where: {
          addresseeId: uid,
          requester: { // relation via requesterId -> User
            username: byRequesterUsername ?? undefined,
          },
        },
        select: { id: true, status: true },
      });

  if (!friendship) {
    return NextResponse.json({ ok: false, message: "Förfrågan hittades inte." }, { status: 404 });
  }

  if (friendship.status === "ACCEPTED") {
    return NextResponse.json({ ok: true }, { status: 200 });
  }
  if (friendship.status !== "PENDING") {
    return NextResponse.json({ ok: false, message: "Kan inte acceptera denna förfrågan." }, { status: 400 });
  }

  await prisma.friendship.update({
    where: { id: friendship.id },
    data: { status: "ACCEPTED" },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
