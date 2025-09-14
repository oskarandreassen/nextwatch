import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import type { Prisma } from "@prisma/client";

// --------- typer för request ----------
type TMDBTitle = {
  id: number;
  title: string;
  year?: string | number | null;
  poster?: string | null;
};

type OnboardingPayload = {
  displayName: string;
  dob?: string; // "YYYY-MM-DD"
  region: string; // "SE"
  language: string; // "sv"
  providers: string[]; // ["Netflix", "Disney+", ...]
  favoriteMovie?: TMDBTitle | null;
  favoriteShow?: TMDBTitle | null;
  favoriteGenres?: string[];
  dislikedGenres?: string[];
};

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

    const raw: unknown = await req.json();
    const b = raw as OnboardingPayload;

    if (!b.displayName || !b.region || !b.language) {
      return NextResponse.json(
        { ok: false, error: "Obligatoriska fält saknas." },
        { status: 400 }
      );
    }

    const dobDate = parseDob(b.dob);

    // --- Typed UPDATE ---
    const updateData: Prisma.ProfileUpdateInput = {
      displayName: b.displayName,
      region: b.region,
      locale: `${b.language}-${b.region}`,
      uiLanguage: b.language,
      providers: (b.providers ?? []) as unknown as Prisma.InputJsonValue,
      // JSON: InputJsonValue | NullableJsonNullValueInput
      favoriteMovie:
        (b.favoriteMovie ?? null) as unknown as Prisma.InputJsonValue,
      favoriteShow:
        (b.favoriteShow ?? null) as unknown as Prisma.InputJsonValue,
      favoriteGenres: b.favoriteGenres
        ? { set: b.favoriteGenres }
        : undefined,
      dislikedGenres: b.dislikedGenres
        ? { set: b.dislikedGenres }
        : undefined,
      updatedAt: new Date(),
      // Date kan sättas direkt i UpdateInput
      dob: dobDate ?? undefined,
    };

    // --- Typed CREATE (checked) ---
    const createData: Prisma.ProfileCreateInput = {
      user: { connect: { id: uid } }, // relation
      displayName: b.displayName,
      dob: dobDate ?? new Date("2000-01-01"),
      region: b.region,
      locale: `${b.language}-${b.region}`,
      uiLanguage: b.language,
      providers: (b.providers ?? []) as unknown as Prisma.InputJsonValue,
      favoriteMovie:
        (b.favoriteMovie ?? null) as unknown as Prisma.InputJsonValue,
      favoriteShow:
        (b.favoriteShow ?? null) as unknown as Prisma.InputJsonValue,
      favoriteGenres: { set: b.favoriteGenres ?? [] },
      dislikedGenres: { set: b.dislikedGenres ?? [] },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Något gick fel vid sparning.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
