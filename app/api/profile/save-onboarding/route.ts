// app/api/profile/save-onboarding/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FavoriteTitle = {
  id: number;
  title: string;
  year?: string;
  poster?: string;
};

// Hjälpare: gör om null/objekt till rätt Prisma JSON-input
function asJsonOrUndef<T extends object>(
  val: T | null | undefined
): Prisma.InputJsonValue | undefined {
  return val != null ? (val as unknown as Prisma.InputJsonValue) : undefined;
}

export async function POST(req: NextRequest) {
  try {
    // 1) Hämta UID från cookie (OBS: await)
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return NextResponse.json(
        { ok: false, message: "Ingen session hittades." },
        { status: 401 }
      );
    }

    // 2) Läs body
    const body = (await req.json()) as {
      displayName?: string;
      dob?: string; // "YYYY-MM-DD"
      region?: string;
      locale?: string;
      uiLanguage?: string;
      providers?: string[];
      favoriteMovie?: FavoriteTitle | null;
      favoriteShow?: FavoriteTitle | null;
      favoriteGenres?: string[];
      dislikedGenres?: string[];
    };

    const displayName = (body.displayName ?? "").trim();
    const region = (body.region ?? "SE").trim();
    const locale = (body.locale ?? "sv-SE").trim();
    const uiLanguage = (body.uiLanguage ?? "sv").trim();

    const providers = Array.isArray(body.providers) ? body.providers : [];
    const favoriteGenres = Array.isArray(body.favoriteGenres)
      ? body.favoriteGenres
      : [];
    const dislikedGenres = Array.isArray(body.dislikedGenres)
      ? body.dislikedGenres
      : [];

    // DOB: om ogiltigt datum -> null
    const dob =
      body.dob && !Number.isNaN(new Date(body.dob).getTime())
        ? new Date(body.dob)
        : null;

    // 3) Minimikrav
    if (!displayName || !dob) {
      return NextResponse.json(
        { ok: false, message: "Obligatoriska fält saknas." },
        { status: 400 }
      );
    }

    // 4) Upsert
    const createData = {
      userId: uid,
      displayName,
      dob,
      region,
      locale,
      uiLanguage,
      providers: providers as unknown as Prisma.InputJsonValue, // JSONB
      favoriteMovie: asJsonOrUndef(body.favoriteMovie),
      favoriteShow: asJsonOrUndef(body.favoriteShow),
      favoriteGenres,
      dislikedGenres,
    };

    const updateData = {
      displayName,
      region,
      locale,
      uiLanguage,
      providers: providers as unknown as Prisma.InputJsonValue,
      favoriteMovie: asJsonOrUndef(body.favoriteMovie),
      favoriteShow: asJsonOrUndef(body.favoriteShow),
      favoriteGenres,
      dislikedGenres,
      updatedAt: new Date(),
      ...(dob ? { dob } : {}), // låt bli att skriva över om tomt
    };

    const profile = await prisma.profile.upsert({
      where: { userId: uid },
      create: createData,
      update: updateData,
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
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
