import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  displayName: string;
  region: string;
  uiLanguage: string;
  providers: string[];
  dob: string; // ISO date (yyyy-mm-dd)
  favoriteMovie?: string;
  favoriteShow?: string;
  favoriteGenres?: string[];
  dislikedGenres?: string[];
};

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

    const body = (await req.json()) as Payload;

    const dobDate = new Date(body.dob);

    await prisma.profile.upsert({
      where: { userId: uid },
      create: {
        userId: uid,
        displayName: body.displayName || null,
        region: body.region,
        uiLanguage: body.uiLanguage,
        locale: `${body.uiLanguage}-${body.region}`,
        providers: body.providers,
        dob: dobDate,
        favoriteMovie: body.favoriteMovie || null,
        favoriteShow: body.favoriteShow || null,
        favoriteGenres: body.favoriteGenres ?? [],
        dislikedGenres: body.dislikedGenres ?? [],
      },
      update: {
        displayName: body.displayName || null,
        region: body.region,
        uiLanguage: body.uiLanguage,
        locale: `${body.uiLanguage}-${body.region}`,
        providers: body.providers,
        dob: dobDate,
        favoriteMovie: body.favoriteMovie || null,
        favoriteShow: body.favoriteShow || null,
        favoriteGenres: body.favoriteGenres ?? [],
        dislikedGenres: body.dislikedGenres ?? [],
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
