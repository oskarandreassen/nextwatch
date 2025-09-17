// app/api/friends/search/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Status = "NONE" | "PENDING_OUT" | "PENDING_IN" | "ACCEPTED";

function normalizeQuery(q: string | null): string | null {
  if (!q) return null;
  const s = q.trim();
  return s.length >= 2 ? s : null;
}

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) {
    return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });
  }

  const q = normalizeQuery(new URL(req.url).searchParams.get("q"));
  if (!q) {
    return NextResponse.json({ ok: true, users: [] }, { status: 200 });
  }

  // Hämta kandidater (exkludera mig själv)
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: uid },
      OR: [
        { username: { startsWith: q.toLowerCase(), mode: "insensitive" } },
        { profile: { is: { displayName: { contains: q, mode: "insensitive" } } } },
      ],
    },
    select: {
      id: true,
      username: true,
      profile: { select: { displayName: true } },
    },
    take: 20,
  });

  const candidateIds = candidates.map((u) => u.id);

  // Hämta ev. befintliga relationsstatusar mellan mig och kandidaterna
  const relations = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: uid, addresseeId: { in: candidateIds } },
        { requesterId: { in: candidateIds }, addresseeId: uid },
      ],
    },
    select: {
      requesterId: true,
      addresseeId: true,
      status: true,
    },
  });

  const statusMap = new Map<string, Status>();
  for (const r of relations) {
    if (r.status === "ACCEPTED") {
      const other = r.requesterId === uid ? r.addresseeId : r.requesterId;
      statusMap.set(other, "ACCEPTED");
      continue;
    }
    if (r.status === "PENDING") {
      if (r.requesterId === uid) {
        statusMap.set(r.addresseeId, "PENDING_OUT");
      } else if (r.addresseeId === uid) {
        statusMap.set(r.requesterId, "PENDING_IN");
      }
    }
  }

  const users = candidates.map((u) => ({
    id: u.id,
    username: u.username ?? null,
    displayName: u.profile?.displayName ?? null,
    status: statusMap.get(u.id) ?? ("NONE" as Status),
  }));

  return NextResponse.json({ ok: true, users }, { status: 200 });
}
