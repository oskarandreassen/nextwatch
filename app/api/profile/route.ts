// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../lib/prisma";

export async function GET() {
  const cookieStore = await cookies();
  const uid = cookieStore.get("nw_uid")?.value || null;
  if (!uid) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: uid } });
  return NextResponse.json({ ok: true, profile });
}

export async function PUT(req: Request) {
  const cookieStore = await cookies();
  const uid = cookieStore.get("nw_uid")?.value || null;
  if (!uid) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    region, locale, uiLanguage, providers, dob, yearPreference, recycleAfterDays, displayName,
  } = body as Partial<{
    region: string; locale: string; uiLanguage: string; providers: unknown;
    dob: string; yearPreference: string; recycleAfterDays: number; displayName: string | null;
  }>;

  // se till att User finns (din User.id saknar default)
  await prisma.user.upsert({
    where: { id: uid },
    update: {},
    create: { id: uid, plan: "free" },
  });

  const profile = await prisma.profile.upsert({
    where: { userId: uid },
    update: {
      region: region ?? undefined,
      locale: locale ?? undefined,
      uiLanguage: uiLanguage ?? undefined,
      providers: providers ?? undefined,
      dob: dob ? new Date(dob) : undefined,
      yearPreference: yearPreference ?? undefined,
      recycleAfterDays: typeof recycleAfterDays === "number" ? recycleAfterDays : undefined,
      displayName: typeof displayName === "string" ? (displayName || null) : undefined,
      updatedAt: new Date(),
    },
    create: {
      userId: uid,
      region: region ?? "SE",
      locale: locale ?? "sv-SE",
      uiLanguage: uiLanguage ?? "sv",
      providers: providers ?? "[]",
      dob: dob ? new Date(dob) : new Date("2000-01-01"),
      yearPreference: yearPreference ?? "all",
      recycleAfterDays: typeof recycleAfterDays === "number" ? recycleAfterDays : 14,
      displayName: typeof displayName === "string" ? (displayName || null) : null,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, profile });
}
