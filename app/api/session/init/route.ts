import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // cookie sätts i middleware, men ha fallback här ändå
  let uid = cookies().get("nw_uid")?.value;
  if (!uid) {
    uid = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const res = NextResponse.json({ ok: true, userId: uid, hasProfile: false });
    res.cookies.set("nw_uid", uid, { httpOnly: true, sameSite: "Lax", path: "/", maxAge: 60*60*24*365 });
    // skapa user
    await prisma.user.upsert({ where: { id: uid }, update: {}, create: { id: uid } });
    return res;
  }

  await prisma.user.upsert({ where: { id: uid }, update: {}, create: { id: uid } });
  const profile = await prisma.profile.findUnique({ where: { userId: uid } });
  return NextResponse.json({ ok: true, userId: uid, hasProfile: !!profile });
}
