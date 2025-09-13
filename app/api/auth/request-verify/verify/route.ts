import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") || "";
    if (!token) return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });

    const v = await prisma.verification.findUnique({ where: { token } });
    if (!v) return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 400 });
    if (v.expiresAt < new Date()) {
      await prisma.verification.delete({ where: { token } });
      return NextResponse.json({ ok: false, error: "Token expired" }, { status: 400 });
    }

    // Aktivera användarens email
    await prisma.user.update({
      where: { id: v.userId },
      data: { email: v.email, emailVerified: new Date() },
    });

    // Sätt displayName om vi har det och profil finns
    const existingProfile = await prisma.profile.findUnique({ where: { userId: v.userId } });
    if (existingProfile && v.name) {
      await prisma.profile.update({
        where: { userId: v.userId },
        data: { displayName: v.name },
      });
    }

    await prisma.verification.delete({ where: { token } });

    return NextResponse.redirect(new URL("/onboarding", req.url));
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
