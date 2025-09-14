// app/api/group/profile/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value;
  if (!uid) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

  const profile = await prisma.profile.findUnique({
    where: { userId: uid },
    select: {
      userId: true,
      region: true,
      locale: true,
      providers: true,
      favoriteGenres: true,
      dislikedGenres: true,
      displayName: true,
    },
  });

  return NextResponse.json({ ok: true, profile });
}
