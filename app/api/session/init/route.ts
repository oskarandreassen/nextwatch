import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function newId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    let uid = cookieStore.get("nw_uid")?.value;

    if (!uid) {
      uid = newId();
      await prisma.user.upsert({ where: { id: uid }, update: {}, create: { id: uid } });
      const res = NextResponse.json({ ok: true, userId: uid, hasProfile: false });
      res.cookies.set("nw_uid", uid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
      return res;
    }

    await prisma.user.upsert({ where: { id: uid }, update: {}, create: { id: uid } });
    const profile = await prisma.profile.findUnique({ where: { userId: uid } });
    return NextResponse.json({ ok: true, userId: uid, hasProfile: !!profile });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
