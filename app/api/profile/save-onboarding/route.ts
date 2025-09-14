import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  displayName?: string;
  dob?: string;
  region?: string;
  locale?: string;
  uiLanguage?: string;
  providers?: string[]; // vi sparar som JSON i DB
  favoriteMovie?: string;
  favoriteShow?: string;
  favoriteGenres?: string[];
  dislikedGenres?: string[];
};

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const uid = cookieStore.get("nw_uid")?.value;
    if (!uid) {
      return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });
    }

    const body = (await req.json()) as Body;

    // Validera/normalisera
    const providersJson: Prisma.JsonValue =
      Array.isArray(body.providers) ? body.providers : [];

    const dobDate = body.dob ? new Date(body.dob) : undefined;

    const profile = await prisma.profile.upsert({
      where: { userId: uid },
      update: {
        displayName: body.displayName,
        dob: dobDate,
        region: body.region,
        locale: body.locale,
        uiLanguage: body.uiLanguage,
        providers: providersJson,
        favoriteMovie: body.favoriteMovie,
        favoriteShow: body.favoriteShow,
        favoriteGenres: Array.isArray(body.favoriteGenres) ? body.favoriteGenres : undefined,
        dislikedGenres: Array.isArray(body.dislikedGenres) ? body.dislikedGenres : undefined,
        updatedAt: new Date(),
      },
      create: {
        userId: uid,
        displayName: body.displayName,
        dob: dobDate ?? new Date("2000-01-01"),
        region: body.region ?? "SE",
        locale: body.locale ?? "sv-SE",
        uiLanguage: body.uiLanguage ?? "sv",
        providers: providersJson,
        favoriteMovie: body.favoriteMovie,
        favoriteShow: body.favoriteShow,
        favoriteGenres: Array.isArray(body.favoriteGenres) ? body.favoriteGenres : [],
        dislikedGenres: Array.isArray(body.dislikedGenres) ? body.dislikedGenres : [],
      },
      select: {
        userId: true,
        displayName: true,
        region: true,
        locale: true,
        uiLanguage: true,
        favoriteMovie: true,
        favoriteShow: true,
        favoriteGenres: true,
        dislikedGenres: true,
      },
    });

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
