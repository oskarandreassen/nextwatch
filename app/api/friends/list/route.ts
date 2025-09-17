// app/api/friends/list/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type PublicUser = {
  id: string;
  username: string | null;
  displayName: string | null;
};

type PendingInItem = {
  requestId: string;
  from: PublicUser;
};

type PendingOutItem = {
  requestId: string;
  to: PublicUser;
};

function toPublic(u: { id: string; username: string | null; profile: { displayName: string | null } | null }): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.profile?.displayName ?? null,
  };
}

export async function GET() {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) {
    return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });
  }

  const rows = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: uid }, { addresseeId: uid }],
    },
    select: {
      id: true,
      requesterId: true,
      addresseeId: true,
      status: true,
      requester: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
      addressee: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const friends: PublicUser[] = [];
  const pendingIn: PendingInItem[] = [];
  const pendingOut: PendingOutItem[] = [];

  for (const r of rows) {
    if (r.status === "ACCEPTED") {
      const other = r.requesterId === uid ? r.addressee : r.requester;
      friends.push(toPublic(other));
      continue;
    }
    if (r.status === "PENDING") {
      if (r.addresseeId === uid) {
        pendingIn.push({ requestId: r.id, from: toPublic(r.requester) });
      } else if (r.requesterId === uid) {
        pendingOut.push({ requestId: r.id, to: toPublic(r.addressee) });
      }
      continue;
    }
    // BLOCKED – hoppa över i listan
  }

  return NextResponse.json({ ok: true, friends, pendingIn, pendingOut }, { status: 200 });
}
