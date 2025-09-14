// app/api/profile/save-onboarding/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ——— Helpers ———
function toNumber(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim() !== "" && !Number.isNaN(Number(n))) {
    return Number(n);
  }
  return null;
}

/**
 * Tillåt flera format från klienten:
 *  - string  -> { title: str }
 *  - { id, title } eller { id, name }
 *  - { tmdbId, name/title, ... }
 *  - null/undefined -> Prisma.JsonNull
 */
function normalizeFavorite(
  v: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (v == null) return Prisma.JsonNull;

  if (typeof v === "string") {
    const s = v.trim();
    if (s.length === 0) return Prisma.JsonNull;
    return { title: s } as Prisma.InputJsonValue;
  }

  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const id =
      toNumber(o.id) ?? toNumber(o.tmdbId) ?? toNumber(o["tmdb_id"]) ?? null;
    const title =
      (typeof o.title === "string" && o.title) ||
      (typeof o.name === "string" && o.name) ||
      null;
    const year =
      typeof o.year === "string"
        ? o.year
        : typeof o.releaseYear === "string"
        ? (o.releaseYear as string)
        : undefined;
    const poster =
      typeof o.poster === "string"
        ? (o.poster as string)
        : typeof o.poster_path === "string"
        ? (o.poster_path as string)
        : undefined;

    const out: Record<string, unknown> = {};
    if (id !== null) out.id = id;
    if (title) out.title = title;
    if (year) out.year = year;
    if (poster !== undefined) out.poster = poster;

    if (!("id" in out) && !("title" in out)) return Prisma.JsonNull;
    return out as Prisma.InputJsonValue;
  }

  return Prisma.JsonNull;
}

function toProvidersJson(p: unknown): Prisma.InputJsonValue {
  if (Array.isArray(p)) {
    const norm = p
      .map((x) => {
        if (typeof x === "string" || typeof x === "number") {
          return String(x);
        }
        if (x && typeof x === "object") {
          const rec = x as Record<string, unknown>;
          const id =
            (typeof rec.id === "string" && rec.id) ||
            (typeof rec.id === "number" && String(rec.id)) ||
            null;
          return id ?? null;
        }
        return null;
      })
      .filter((v): v is string => v !== null);
    return norm as unknown as Prisma.InputJsonValue;
  }
  // Fallback: kapsla in vad som än kom
  return (p ?? []) as Prisma.InputJsonValue;
}

// ——— Route ———
export async function POST(req: NextRequest) {
  try {
    // 1) Cookie (Next.js 15: async)
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return NextResponse.json(
        { ok: false, message: "Ingen session hittades (nw_uid saknas)." },
        { status: 401 }
      );
    }

    // 2) Body
    const body = (await req.json()) as {
      displayName?: string;
      dob?: string; // YYYY-MM-DD
      region?: string;
      locale?: string;
      uiLanguage?: string;
      providers?: unknown;
      favoriteMovie?: unknown;
      favoriteShow?: unknown;
      favoriteGenres?: string[];
      dislikedGenres?: string[];
    };

    const {
      displayName,
      dob,
      region,
      locale,
      uiLanguage,
      providers,
      favoriteMovie,
      favoriteShow,
      favoriteGenres = [],
      dislikedGenres = [],
    } = body ?? {};

    // 3) Validering
    const missing: string[] = [];
    if (!displayName?.trim()) missing.push("displayName");
    if (!dob?.trim()) missing.push("dob");
    if (!region?.trim()) missing.push("region");
    if (!locale?.trim()) missing.push("locale");
    if (!uiLanguage?.trim()) missing.push("uiLanguage");
    if (missing.length) {
      return NextResponse.json(
        { ok: false, message: `Obligatoriska fält saknas: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // 4) Normalisering
    const favMovieJson = normalizeFavorite(favoriteMovie);
    const favShowJson = normalizeFavorite(favoriteShow);
    const providersJson = toProvidersJson(providers);

    // 5) Upsert
    const updateData: Prisma.ProfileUpdateInput = {
      displayName,
      region,
      locale,
      uiLanguage,
      providers: providersJson,
      favoriteMovie: favMovieJson,
      favoriteShow: favShowJson,
      favoriteGenres, // text[]
      dislikedGenres, // text[]
      updatedAt: new Date(),
    };

    const createData: Prisma.ProfileCreateInput = {
      user: { connect: { id: uid } },
      dob: new Date(dob!),
      displayName,
      region: region!,
      locale: locale!,
      uiLanguage: uiLanguage!,
      providers: providersJson,
      favoriteMovie: favMovieJson,
      favoriteShow: favShowJson,
      favoriteGenres,
      dislikedGenres,
      updatedAt: new Date(),
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
    console.error("[save-onboarding] error:", err);
    const message = err instanceof Error ? err.message : "Ett fel uppstod.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
