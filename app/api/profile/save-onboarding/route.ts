import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

type FavoriteTitle = {
  id: number;
  title: string;
  year?: string | null;
  poster?: string | null;
};

type Body = {
  displayName: string;
  dob: string;                // "YYYY-MM-DD"
  uiLanguage: string;         // "sv" | "en" | ...
  region: string;             // "SE" | ...
  locale: string;             // "sv-SE" | ...
  providers: string[];        // ["Netflix", ...]
  favoriteMovie?: FavoriteTitle | null;
  favoriteShow?: FavoriteTitle | null;
  favoriteGenres: string[];   // <— LIKES
  dislikedGenres: string[];   // <— DISLIKES
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // 1) Hämta session
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return bad("Ingen session. Logga in igen.", 401);

  // 2) Läs & validera body
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

  // 3) Grundkrav
  if (
    !displayName?.trim() ||
    !dob?.trim() ||
    !uiLanguage?.trim() ||
    !region?.trim() ||
    !locale?.trim()
  ) {
    return bad("Obligatoriska fält saknas.");
  }

  // 4) Säkerställ typer
  if (!Array.isArray(providers)) return bad("providers måste vara en lista.");
  if (!Array.isArray(favoriteGenres)) return bad("favoriteGenres måste vara en lista.");
  if (!Array.isArray(dislikedGenres)) return bad("dislikedGenres måste vara en lista.");

  // 5) Datum-parse (lås till midnatt UTC för att undvika TZ-drift)
  const dobIso = `${dob}T00:00:00.000Z`;
  const dobDate = new Date(dobIso);
  if (Number.isNaN(dobDate.getTime())) return bad("Födelsedatum är ogiltigt.");

  // 6) Upsert
  try {
    const updated = await prisma.profile.upsert({
      where: { userId: uid },
      update: {
        displayName,
        region,
        locale,
        uiLanguage,
        providers,              // JSONB
        favoriteMovie,          // JSONB
        favoriteShow,           // JSONB
        favoriteGenres,         // text[]
        dislikedGenres,         // text[]
        updatedAt: new Date(),
      },
      create: {
        user: { connect: { id: uid } }, // relation krävs vid create
        dob: dobDate,
        displayName,
        region,
        locale,
        uiLanguage,
        providers,
        favoriteMovie,
        favoriteShow,
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
