import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_MAX = 3;
const PREMIUM_MAX = 8;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase();
  if (!code) return NextResponse.json({ ok: false, error: "missing code" }, { status: 400 });

  const group = await prisma.group.findUnique({ where: { code } });
  if (!group) return NextResponse.json({ ok: false, error: "group not found" }, { status: 404 });

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

  return NextResponse.json({
    ok: true,
    code,
    size: members.length,
    cap,
    premium,
  });
}
