// app/api/profile/save-onboarding/route.ts
import { NextResponse, NextRequest } from "next/server";
import { cookies } from "next/headers";
import prisma, { Prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Små type guards så vi slipper 'any' */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isString(v: unknown): v is string {
  return typeof v === "string";
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(isString);
}
type Fav = { id: number; title: string; year?: string; poster?: string };

function isFav(v: unknown): v is Fav {
  return (
    isRecord(v) &&
    typeof v.id === "number" &&
    isString(v.title) &&
    (v.year === undefined || isString(v.year)) &&
    (v.poster === undefined || isString(v.poster))
  );
}

export async function POST(req: NextRequest) {
  // 1) UID från cookie
  const jar = cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) {
    return NextResponse.json(
      { ok: false, message: "Ingen session hittades." },
      { status: 401 }
    );
  }

  // 2) Läs råpayload och plocka ut fält – tolerera flera varianter
  const raw = (await req.json()) as unknown;
  if (!isRecord(raw)) {
    return NextResponse.json(
      { ok: false, message: "Ogiltig payload (måste vara JSON-objekt)." },
      { status: 400 }
    );
  }

  const displayName = isString(raw.displayName) ? raw.displayName.trim() : "";
  const dobStr = isString(raw.dob) ? raw.dob.trim() : "";
  const region = isString(raw.region) ? raw.region.trim() : "";
  const locale = isString(raw.locale) ? raw.locale.trim() : "";

  // UI-språk: acceptera uiLanguage eller language
  const uiLanguageRaw =
    (isString((raw as Record<string, unknown>).uiLanguage)
      ? (raw as Record<string, unknown>).uiLanguage
      : undefined) ??
    (isString((raw as Record<string, unknown>).language)
      ? (raw as Record<string, unknown>).language
      : undefined);
  const uiLanguage = uiLanguageRaw ? uiLanguageRaw.trim() : "";

  // Providers: array av strängar
  const providers = isStringArray(raw.providers) ? raw.providers : [];

  // Genrer: array av strängar
  const favoriteGenres = isStringArray(raw.favoriteGenres)
    ? raw.favoriteGenres
    : [];
  const dislikedGenres = isStringArray(raw.dislikedGenres)
    ? raw.dislikedGenres
    : [];

  // Favoriter: objekt eller null -> Prisma Json
  const favoriteMovieVal = isFav(raw.favoriteMovie)
    ? (raw.favoriteMovie as Fav)
    : null;
  const favoriteShowVal = isFav(raw.favoriteShow)
    ? (raw.favoriteShow as Fav)
    : null;

  // 3) Obligatoriska fält – tydlig lista
  const missing: string[] = [];
  if (!displayName) missing.push("displayName");
  if (!dobStr) missing.push("dob");
  if (!region) missing.push("region");
  if (!locale) missing.push("locale");
  if (!uiLanguage) missing.push("uiLanguage");

  if (missing.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        message: "Obligatoriska fält saknas.",
        missing,
      },
      { status: 400 }
    );
  }

  // 4) Konvertera datum – vi låser tid till 00:00 för en ren DATE-kolumn
  //    (Postgres 'DATE' ignorerar tid)
  const dob = new Date(`${dobStr}T00:00:00.000Z`);
  if (Number.isNaN(dob.getTime())) {
    return NextResponse.json(
      { ok: false, message: "Ogiltigt födelsedatum." },
      { status: 400 }
    );
  }

  // 5) Mappa JSON-fält till Prisma InputJsonValue / JsonNull
  const favoriteMovie: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
    favoriteMovieVal ?? Prisma.JsonNull;
  const favoriteShow: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
    favoriteShowVal ?? Prisma.JsonNull;

  try {
    const result = await prisma.profile.upsert({
      where: { userId: uid },
      update: {
        displayName,
        dob, // Prisma förväntar Date, din kolumn är DATE -> OK
        region,
        locale,
        uiLanguage,
        providers, // Json (array med strängar) -> OK
        favoriteMovie,
        favoriteShow,
        favoriteGenres,
        dislikedGenres,
        updatedAt: new Date(),
      },
      create: {
        user: { connect: { id: uid } },
        displayName,
        dob,
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

    return NextResponse.json({ ok: true, profile: result });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Kunde inte spara onboarding.";
    // valfritt: console.error(err);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
