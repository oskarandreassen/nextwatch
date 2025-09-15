// app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ ok: false, message: "Token saknas." }, { status: 400 });
    }

    const v = await prisma.verification.findUnique({ where: { token } });
    if (!v) {
      return NextResponse.json({ ok: false, message: "Ogiltig eller förbrukad token." }, { status: 400 });
    }
    if (v.expiresAt.getTime() < Date.now()) {
      await prisma.verification.delete({ where: { token } }).catch(() => {});
      return NextResponse.json({ ok: false, message: "Token har gått ut." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: v.userId },
        data: { emailVerified: new Date() },
      }),
      prisma.verification.deleteMany({ where: { userId: v.userId } }),
    ]);

    return NextResponse.json({ ok: true, message: "E-post verifierad." });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internt fel.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
