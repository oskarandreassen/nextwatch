import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ ok: false, error: "missing code" }, { status: 400 });

  const members = await prisma.groupMember.findMany({
    where: { groupCode: code },
    select: { userId: true, joinedAt: true },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json({ ok: true, code, members });
}
