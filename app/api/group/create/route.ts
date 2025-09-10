import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function code6() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}

export async function POST() {
  const c = await cookies();
  const uid = c.get("nw_uid")?.value;
  if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status:400 });

  // se till att user finns
  await prisma.user.upsert({ where:{ id:uid }, update:{}, create:{ id:uid } });

  // skapa unik kod
  let code = code6();
  for (let i=0;i<5;i++) {
    const exists = await prisma.group.findUnique({ where:{ code } });
    if (!exists) break;
    code = code6();
  }

  await prisma.group.create({ data:{ code, createdBy: uid } });
  await prisma.groupMember.create({ data:{ groupCode: code, userId: uid } });

  return NextResponse.json({ ok:true, code });
}
