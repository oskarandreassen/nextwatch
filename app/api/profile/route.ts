import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const uid = cookies().get("nw_uid")?.value;
  if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status: 400 });
  const profile = await prisma.profile.findUnique({ where: { userId: uid } });
  return NextResponse.json({ ok:true, profile });
}

export async function POST(req: Request) {
  const uid = cookies().get("nw_uid")?.value;
  if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status: 400 });

  const body = await req.json();
  const { dob, providers = [], uiLanguage = "sv", yearPreference = "all", region = "SE", locale = "sv-SE" } = body;
  if (!dob) return NextResponse.json({ ok:false, error:"Missing dob" }, { status: 400 });

  await prisma.user.upsert({ where: { id: uid }, update: {}, create: { id: uid } });

  const saved = await prisma.profile.upsert({
    where: { userId: uid },
    update: { dob: new Date(dob), providers, uiLanguage, yearPreference, region, locale, updatedAt: new Date() },
    create: { userId: uid, dob: new Date(dob), providers, uiLanguage, yearPreference, region, locale }
  });

  return NextResponse.json({ ok:true, profile: saved });
}
