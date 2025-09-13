import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok: true, hasSession: false, hasProfile: false, emailVerified: false });

    const user = await prisma.user.findUnique({ where: { id: uid } });
    const profile = await prisma.profile.findUnique({ where: { userId: uid } });

    return NextResponse.json({
      ok: true,
      hasSession: true,
      hasProfile: Boolean(profile),
      emailVerified: Boolean(user?.emailVerified),
    });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
