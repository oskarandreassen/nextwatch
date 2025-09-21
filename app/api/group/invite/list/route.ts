import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicUser = { id: string; displayName: string | null; username: string | null };

type InviteItem = {
  id: string;
  groupCode: string;
  status: string;
  createdAt: string;
  from?: PublicUser;
  to?: PublicUser;
};

type Payload = {
  ok: true;
  incoming: InviteItem[];
  outgoing: InviteItem[];
};

async function cleanup(): Promise<void> {
  // expired pending
  await prisma.groupInvite.deleteMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
  });

  // invites vars grupp saknas
  const groups = await prisma.group.findMany({ select: { code: true } });
  const existing = new Set(groups.map((g) => g.code));
  await prisma.groupInvite.deleteMany({
    where: {
      status: "pending",
      NOT: { groupCode: { in: Array.from(existing) } },
    },
  });
}

export async function GET(): Promise<ReturnType<typeof NextResponse.json<Payload>>> {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? "";

  await cleanup();

  const [incoming, outgoing] = await Promise.all([
    prisma.groupInvite.findMany({
      where: { toUserId: uid },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        fromUser: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    }),
    prisma.groupInvite.findMany({
      where: { fromUserId: uid },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        toUser: {
          select: {
            id: true,
            username: true,
            profile: { select: { displayName: true } },
          },
        },
      },
    }),
  ]);

  const mapIncoming: InviteItem[] = incoming.map((r) => ({
    id: r.id,
    groupCode: r.groupCode,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    from: {
      id: r.fromUser.id,
      displayName: r.fromUser.profile?.displayName ?? null,
      username: r.fromUser.username ?? null,
    },
  }));

  const mapOutgoing: InviteItem[] = outgoing.map((r) => ({
    id: r.id,
    groupCode: r.groupCode,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    to: {
      id: r.toUser.id,
      displayName: r.toUser.profile?.displayName ?? null,
      username: r.toUser.username ?? null,
    },
  }));

  return NextResponse.json({ ok: true, incoming: mapIncoming, outgoing: mapOutgoing });
}
