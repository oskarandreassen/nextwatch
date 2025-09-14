// app/api/profile/save-onboarding/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PickedTitle = { id: number; title: string; year?: string; poster?: string | null };

interface Payload {
  displayName?: string;
  dobISO: string;
  uiLanguage: string;
  region: string;
  locale: string;
  providers: string[];
  favoriteMovie?: PickedTitle | null;
  favoriteShow?: PickedTitle | null;
  favoriteGenres: string[];
  dislikedGenres: string[];
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

    const body = (await req.json()) as Payload;
    const dob = new Date(body.dobISO);

    // säkerställ user
    await prisma.user.upsert({
      where: { id: uid },
      update: {},
      create: { id: uid },
    });

    const payload = {
      userId: uid,
      displayName: body.displayName || null,
      dob,
      uiLanguage: body.uiLanguage,
      region: body.region,
      locale: body.locale,
      providers: body.providers,
      // ✅ skriv till mappade fälten
      favoriteMovie: body.favoriteMovie?.title || null,
      favoriteShow: body.favoriteShow?.title || null,
      favoriteGenres: body.favoriteGenres || [],
      dislikedGenres: body.dislikedGenres || [],
      updatedAt: new Date(),
      // använd gärna dina redan existerande defaultar:
      yearPreference: "all",
      recycleAfterDays: 14,
    };

    await prisma.profile.upsert({
      where: { userId: uid },
      create: payload,
      update: payload,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
