// app/api/profile/exists/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

export async function GET() {
  const cookieStore = await cookies();
  const uid = cookieStore.get("nw_uid")?.value || null;
  if (!uid) return NextResponse.json({ ok: true, hasProfile: false });

  const profile = await prisma.profile.findUnique({ where: { userId: uid } });
  return NextResponse.json({ ok: true, hasProfile: !!profile });
}
