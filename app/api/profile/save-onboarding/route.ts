import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client"; // <-- NYTT

type FavoriteTitle = {
  id: number;
  title: string;
  year?: string | null;
  poster?: string | null;
};

type Body = {
  displayName: string;
  dob: string;
  uiLanguage: string;
  region: string;
  locale: string;
  providers: string[];
  favoriteMovie?: FavoriteTitle | null;
  favoriteShow?: FavoriteTitle | null;
  favoriteGenres: string[];
  dislikedGenres: string[];
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return bad("Ingen session. Logga in igen.", 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("Ogiltig JSON body.");
  }

  const {
    displayName,
    dob,
    uiLanguage,
    region,
    locale,
    providers,
    favoriteMovie = null,
    favoriteShow = null,
    favoriteGenres,
    dislikedGenres,
  } = body;

  if (
    !displayName?.trim() ||
    !dob?.trim() ||
    !uiLanguage?.trim() ||
    !region?.trim() ||
    !locale?.trim()
  ) {
    return bad("Obligatoriska fält saknas.");
  }

  if (!Array.isArray(providers)) return bad("providers måste vara en lista.");
  if (!Array.isArray(favoriteGenres)) return bad("favoriteGenres måste vara en lista.");
  if (!Array.isArray(dislikedGenres)) return bad("dislikedGenres måste vara en lista.");

  const dobIso = `${dob}T00:00:00.000Z`;
  const dobDate = new Date(dobIso);
  if (Number.isNaN(dobDate.getTime())) return bad("Födelsedatum är ogiltigt.");

  // Viktigt: Prisma vill ha JSON-sentinels för null
  const favMovieForDb: Prisma.InputJsonValue | Prisma.NullTypes.DbNull =
    favoriteMovie === null ? Prisma.DbNull : (favoriteMovie as Prisma.InputJsonValue);
  const favShowForDb: Prisma.InputJsonValue | Prisma.NullTypes.DbNull =
    favoriteShow === null ? Prisma.DbNull : (favoriteShow as Prisma.InputJsonValue);

  try {
    const updated = await prisma.profile.upsert({
      where: { userId: uid },
      update: {
        displayName,
        region,
        locale,
        uiLanguage,
        providers,
        favoriteMovie: favMovieForDb, // <-- fix
        favoriteShow: favShowForDb,   // <-- fix
        favoriteGenres,
        dislikedGenres,
        updatedAt: new Date(),
      },
      create: {
        user: { connect: { id: uid } },
        dob: dobDate,
        displayName,
        region,
        locale,
        uiLanguage,
        providers,
        favoriteMovie: favMovieForDb, // <-- fix
        favoriteShow: favShowForDb,   // <-- fix
        favoriteGenres,
        dislikedGenres,
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

    return NextResponse.json({ ok: true, profile: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Något gick fel";
    return bad(message, 500);
  }
}
