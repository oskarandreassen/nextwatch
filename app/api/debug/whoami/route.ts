import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const c = await cookies();
  const uid = c.get("nw_uid")?.value || null;
  if (!uid) return NextResponse.json({ ok: false, uid: null, plan: null });
  const u = await prisma.user.findUnique({ where: { id: uid } });
  return NextResponse.json({ ok: true, uid, plan: u?.plan ?? "free" });
}
