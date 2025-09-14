// app/api/auth/request-verify/verify/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }

  const row = await prisma.verification.findUnique({ where: { token } });
  if (!row) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 404 });
  }

  if (row.expiresAt < new Date()) {
    await prisma.verification.delete({ where: { token } }).catch(() => {});
    return NextResponse.json({ ok: false, error: "Token expired" }, { status: 410 });
  }

  await prisma.user.update({
    where: { id: row.userId },
    data: { emailVerified: new Date() },
  });

  if (row.name) {
    await prisma.profile.updateMany({
      where: { userId: row.userId },
      data: { displayName: row.name },
    });
  }

  await prisma.verification.delete({ where: { token } });

  const res = NextResponse.redirect(new URL("/onboarding", req.url), 303);
  const jar = await cookies();
  jar.set({
    name: "nw_uid",
    value: row.userId,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
