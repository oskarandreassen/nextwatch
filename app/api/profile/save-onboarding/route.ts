import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

// --------- typer ----------
type TMDBTitle = {
  id: number;
  title: string;
  year?: string | number | null;
  poster?: string | null;
};

type OnboardingPayload = {
  displayName: string;
  dob?: string; // "YYYY-MM-DD"
  region: string;  // "SE"
  language: string; // "sv"
  providers: string[]; // ["Netflix","Disney+", ...]
  favoriteMovie?: TMDBTitle | null;
  favoriteShow?: TMDBTitle | null;
  favoriteGenres?: string[];
  dislikedGenres?: string[];
};

// Hjälp: parse ISO-date tryggt
function parseDob(input?: string): Date | undefined {
  if (!input) return undefined;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return NextResponse.json(
        { ok: false, error: "Ingen session (nw_uid saknas)." },
        { status: 401 }
      );
    }

    const bodyUnknown: unknown = await req.json();
    // Minimal runtime-validering
    const b = bodyUnknown as OnboardingPayload;

    if (!b.displayName || !b.region || !b.language) {
      return NextResponse.json(
        { ok: false, error: "Obligatoriska fält saknas." },
        { status: 400 }
      );
    }

    const dobDate = parseDob(b.dob);

    // Bygg update/create-objekt utan undefined-fältskrivning
    const updateData: Record<string, unknown> = {
      displayName: b.displayName,
      region: b.region,
      locale: `${b.language}-${b.region}`,
      uiLanguage: b.language,
      providers: b.providers ?? [],
      favoriteMovie: b.favoriteMovie ?? null,
      favoriteShow: b.favoriteShow ?? null,
      favoriteGenres: b.favoriteGenres ?? [],
      dislikedGenres: b.dislikedGenres ?? [],
      updatedAt: new Date(),
    };
    if (dobDate) updateData.dob = dobDate;

    const createData: Record<string, unknown> = {
      userId: uid,
      displayName: b.displayName,
      dob: dobDate ?? new Date("2000-01-01"),
      region: b.region,
      locale: `${b.language}-${b.region}`,
      uiLanguage: b.language,
      providers: b.providers ?? [],
      favoriteMovie: b.favoriteMovie ?? null,
      favoriteShow: b.favoriteShow ?? null,
      favoriteGenres: b.favoriteGenres ?? [],
      dislikedGenres: b.dislikedGenres ?? [],
    };

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
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Något gick fel vid sparning.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
