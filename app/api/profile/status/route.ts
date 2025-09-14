// app/api/profile/status/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value;
  if (!uid) return NextResponse.json({ hasUser: false });

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, emailVerified: true },
  });
  if (!user) return NextResponse.json({ hasUser: false });

  const profile = await prisma.profile.findUnique({
    where: { userId: uid },
    select: { userId: true, displayName: true },
  });

  const hasProfile = !!profile;
  const onboardingDone = hasProfile && !!profile?.displayName;

  return NextResponse.json({
    hasUser: true,
    emailVerified: !!user.emailVerified,
    hasProfile,
    onboardingDone,
  });
}
