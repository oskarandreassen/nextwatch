import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      uid: string;
      displayName?: string;
      dob?: string;                 // "YYYY-MM-DD"
      region?: string;
      locale?: string;
      uiLanguage?: string;
      providers?: string[];
      favoriteMovie?: { id: number; title: string; year?: string; poster?: string } | null;
      favoriteShow?:  { id: number; title: string; year?: string; poster?: string } | null;
      favoriteGenres?: string[];
      dislikedGenres?: string[];
    };

    const {
      uid, displayName, dob, region, locale, uiLanguage,
      providers = [],
      favoriteMovie = null,
      favoriteShow = null,
      favoriteGenres = [],
      dislikedGenres = [],
    } = body;

    if (!uid) {
      return NextResponse.json({ ok: false, message: "Missing uid" }, { status: 400 });
    }

    const dobDate = dob ? new Date(`${dob}T00:00:00Z`) : undefined;

    // Bygg "updateData" utan fält som är undefined:
    const updateData: Prisma.ProfileUpdateInput = {
      ...(displayName !== undefined ? { displayName } : {}),
      ...(dobDate ? { dob: dobDate } : {}),
      ...(region !== undefined ? { region } : {}),
      ...(locale !== undefined ? { locale } : {}),
      ...(uiLanguage !== undefined ? { uiLanguage } : {}),
      ...(providers !== undefined ? { providers } : {}),
      ...(favoriteMovie !== undefined ? { favoriteMovie: favoriteMovie as Prisma.InputJsonValue } : {}),
      ...(favoriteShow  !== undefined ? { favoriteShow:  favoriteShow  as Prisma.InputJsonValue } : {}),
      ...(favoriteGenres !== undefined ? { favoriteGenres } : {}),
      ...(dislikedGenres !== undefined ? { dislikedGenres } : {}),
      updatedAt: new Date(),
    };

    const createData: Prisma.ProfileCreateInput = {
      user: { connect: { id: uid } },
      displayName: displayName ?? null,
      dob: dobDate ?? new Date("2000-01-01T00:00:00Z"),
      region: region ?? "SE",
      locale: locale ?? "sv-SE",
      uiLanguage: uiLanguage ?? "sv",
      providers,
      favoriteMovie: favoriteMovie as Prisma.InputJsonValue,
      favoriteShow:  favoriteShow  as Prisma.InputJsonValue,
      favoriteGenres,
      dislikedGenres,
      updatedAt: new Date(),
    };

    const profile = await prisma.profile.upsert({
      where: { userId: uid },
      update: updateData,
      create: createData,
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

    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save onboarding";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
