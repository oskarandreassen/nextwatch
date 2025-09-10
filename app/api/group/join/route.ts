import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_MAX = 3;
const PREMIUM_MAX = 8;

// Slumpa 6-teckenskod (A-Z, 0-9)
function makeCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const c = makeCode();
    const g = await prisma.group.findUnique({ where: { code: c } });
    if (!g) return c;
  }
  throw new Error("could not allocate group code");
}

export async function POST(req: Request) {
  const c = await cookies();
  const uid = c.get("nw_uid")?.value || null;
  if (!uid) return NextResponse.json({ ok: false, error: "no cookie" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { code?: string } | null;
  const codeInput = body?.code?.trim().toUpperCase();

  // Skapa eller hämta grupp
  let code: string;
  if (!codeInput) {
    code = await uniqueCode();
    await prisma.group.create({ data: { code } });
  } else {
    code = codeInput;
    const g = await prisma.group.findUnique({ where: { code } });
    if (!g) return NextResponse.json({ ok: false, error: "group not found" }, { status: 404 });
  }

  // Kolla om redan medlem
  const existing = await prisma.groupMember.findUnique({
    where: { groupCode_userId: { groupCode: code, userId: uid } },
  });
  if (existing) {
    // returnera info ändå
    const count = await prisma.groupMember.count({ where: { groupCode: code } });
    // premium om NÅGON i gruppen har lifetime
    const members = await prisma.groupMember.findMany({
      where: { groupCode: code },
      select: { userId: true },
    });
    const users = await prisma.user.findMany({
      where: { id: { in: members.map((m) => m.userId) } },
      select: { plan: true },
    });
    const premium = users.some((u) => (u.plan ?? "free") === "lifetime");
    const cap = premium ? PREMIUM_MAX : FREE_MAX;

    return NextResponse.json({ ok: true, code, size: count, cap, premium });
  }

  // Cap baserat på gruppens nuvarande medlemmar (om någon är premium → högre cap)
  const members = await prisma.groupMember.findMany({
    where: { groupCode: code },
    select: { userId: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: { plan: true },
  });
  const premium = users.some((u) => (u.plan ?? "free") === "lifetime");
  const cap = premium ? PREMIUM_MAX : FREE_MAX;

  const size = members.length;
  if (size >= cap) {
    return NextResponse.json(
      { ok: false, error: "group_full", code, size, cap, premium },
      { status: 403 }
    );
  }

  // Lägg till medlem
  await prisma.groupMember.create({
    data: { groupCode: code, userId: uid },
  });
  return NextResponse.json({ ok: true, code, size: size + 1, cap, premium });
}
