import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const c = await cookies();
  const uid = c.get("nw_uid")?.value;
  if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status:400 });
  const user = await prisma.user.findUnique({ where: { id: uid } });
  return NextResponse.json({ ok:true, plan: user?.plan ?? "free", planSince: user?.planSince ?? null });
}
