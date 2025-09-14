// app/api/profile/save-onboarding/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FavoriteTitle = {
  id: number;
  title: string;
  year?: string;
  poster?: string | null;
};

function isFavoriteTitle(v: unknown): v is FavoriteTitle {
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "number" && typeof o.title === "string";
}

export async function POST(req: NextRequest) {
  try {
    // 1) Hämta uid från cookie
    const jar = cookies(); // i Node runtime är detta sync
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return NextResponse.json(
        { ok: false, message: "Ingen session hittades (nw_uid saknas)." },
        { status: 401 }
      );
    }

    // 2) Läs body
    const body = (await req.json()) as {
      displayName?: string;
      dob?: string; // YYYY-MM-DD
      region?: string;
      locale?: string;
      uiLanguage?: string;
      providers?: string[];
      favoriteMovie?: FavoriteTitle | null;
      favoriteShow?: FavoriteTitle | null;
      favoriteGenres?: string[];
      dislikedGenres?: string[];
    };

    const {
      displayName,
      dob,
      region,
      locale,
      uiLanguage,
      providers = [],
      favoriteMovie = null,
      favoriteShow = null,
      favoriteGenres = [],
      dislikedGenres = [],
    } = body ?? {};

    // 3) Grundvalidering + tydligt svar
    const missing: string[] = [];
    if (!displayName?.trim()) missing.push("displayName");
    if (!dob?.trim()) missing.push("dob");
    if (!region?.trim()) missing.push("region");
    if (!locale?.trim()) missing.push("locale");
    if (!uiLanguage?.trim()) missing.push("uiLanguage");

    if (missing.length) {
      return NextResponse.json(
        {
          ok: false,
          message: `Obligatoriska fält saknas: ${missing.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (favoriteMovie !== null && !isFavoriteTitle(favoriteMovie)) {
      return NextResponse.json(
        { ok: false, message: "favoriteMovie har ogiltigt format." },
        { status: 400 }
      );
    }
    if (favoriteShow !== null && !isFavoriteTitle(favoriteShow)) {
      return NextResponse.json(
        { ok: false, message: "favoriteShow har ogiltigt format." },
        { status: 400 }
      );
    }

    // 4) Bygg Update & Create med korrekta Prisma-typer
    // JSON-fälten måste vara InputJsonValue eller Prisma.JsonNull
    const favMovieJson:
      | Prisma.InputJsonValue
      | Prisma.NullableJsonNullValueInput = favoriteMovie === null
      ? Prisma.JsonNull
      : (favoriteMovie as unknown as Prisma.InputJsonValue);

    const favShowJson:
      | Prisma.InputJsonValue
      | Prisma.NullableJsonNullValueInput = favoriteShow === null
      ? Prisma.JsonNull
      : (favoriteShow as unknown as Prisma.InputJsonValue);

    const updateData: Prisma.ProfileUpdateInput = {
      displayName,
      region,
      locale,
      uiLanguage,
      providers, // Json; Prisma serialiserar array -> jsonb
      favoriteMovie: favMovieJson,
      favoriteShow: favShowJson,
      favoriteGenres,  // text[]
      dislikedGenres,  // text[]
      updatedAt: new Date(),
    };

    const createData: Prisma.ProfileCreateInput = {
      user: { connect: { id: uid } },     // <-- VIKTIGT: relation, inte bara userId
      dob: new Date(dob!),                // <-- krävs i CreateInput
      displayName,
      region: region!,
      locale: locale!,
      uiLanguage: uiLanguage!,
      providers,
      favoriteMovie: favMovieJson,
      favoriteShow: favShowJson,
      favoriteGenres,
      dislikedGenres,
      updatedAt: new Date(),
    };

    // 5) Upsert
    const saved = await prisma.profile.upsert({
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

    return NextResponse.json({ ok: true, profile: saved });
  } catch (err) {
    // Server-logg till Vercel
    console.error("[save-onboarding] error:", err);
    const message = err instanceof Error ? err.message : "Ett fel uppstod.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
