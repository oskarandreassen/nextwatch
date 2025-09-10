import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").toUpperCase();
  const c = await cookies();
  const uid = c.get("nw_uid")?.value;
  if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status:400 });
  if (!code) return NextResponse.json({ ok:false, error:"missing code" }, { status:400 });

  const grp = await prisma.group.findUnique({ where:{ code } });
  if (!grp) return NextResponse.json({ ok:false, error:"not found" }, { status:404 });

  // se till att user finns
  await prisma.user.upsert({ where:{ id:uid }, update:{}, create:{ id:uid } });

  // premium-gating: >3 medlemmar kräver minst en 'lifetime'
  const members = await prisma.groupMember.findMany({ where:{ groupCode: code } });
  const memberIds = members.map(m=>m.userId);
  const allUsers = await prisma.user.findMany({ where:{ id: { in: memberIds } } });
  const hasLifetime = allUsers.some(u => (u.plan ?? "free") === "lifetime");

  const sizeAfterJoin = members.length + (memberIds.includes(uid) ? 0 : 1);
  if (sizeAfterJoin > 3 && !hasLifetime) {
    return NextResponse.json({
      ok:false,
      error:"premium_required",
      message:"Grupp större än 3 kräver premium (lifetime) hos minst en medlem."
    }, { status:402 });
  }

  await prisma.groupMember.upsert({
    where:{ groupCode_userId: { groupCode: code, userId: uid } },
    update:{},
    create:{ groupCode: code, userId: uid }
  });

  return NextResponse.json({ ok:true, code, size: sizeAfterJoin, hasLifetime });
}
