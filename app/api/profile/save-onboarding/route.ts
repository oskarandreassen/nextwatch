// app/api/profile/save-onboarding/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// —— Helpers ——
function toNumber(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string" && n.trim() !== "" && !Number.isNaN(Number(n))) {
    return Number(n);
  }
  return null;
}

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
        if (typeof x === "string" || typeof x === "number") return String(x);
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
  return (p ?? []) as Prisma.InputJsonValue;
}

// Centraliserad felrespons (med debug)
function fail(
  status: number,
  message: string,
  debugOn: boolean,
  extra?: Record<string, unknown>
) {
  const body: Record<string, unknown> = { ok: false, message };
  if (debugOn && extra) body.debug = extra;
  return NextResponse.json(body, { status });
}

// —— Route ——
export async function POST(req: NextRequest) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    // 1) Cookie (Next.js 15: async)
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return fail(401, "Ingen session hittades (nw_uid saknas).", debug);
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

    // 3) Basvalidering
    const missing: string[] = [];
    if (!displayName?.trim()) missing.push("displayName");
    if (!dob?.trim()) missing.push("dob");
    if (!region?.trim()) missing.push("region");
    if (!locale?.trim()) missing.push("locale");
    if (!uiLanguage?.trim()) missing.push("uiLanguage");
    if (missing.length) {
      return fail(
        400,
        `Obligatoriska fält saknas: ${missing.join(", ")}`,
        debug,
        { received: body }
      );
    }

    // 4) Säkerställ att user finns (annars FK-fel på connect)
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true },
    });
    if (!user) {
      return fail(
        401,
        "Ogiltig session: användaren finns inte. Logga in igen.",
        debug,
        { uidFromCookie: uid }
      );
    }

    // 5) Normalisering
    const favMovieJson = normalizeFavorite(favoriteMovie);
    const favShowJson = normalizeFavorite(favoriteShow);
    const providersJson = toProvidersJson(providers);

    // 6) Upsert
    const updateData: Prisma.ProfileUpdateInput = {
      displayName,
      region,
      locale,
      uiLanguage,
      providers: providersJson,
      favoriteMovie: favMovieJson,
      favoriteShow: favShowJson,
      favoriteGenres,
      dislikedGenres,
      updatedAt: new Date(),
    };

    const createData: Prisma.ProfileCreateInput = {
      user: { connect: { id: uid } },
      dob: new Date(dob!), // DATE i DB; Prisma Create kräver den här i din modell
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
    // Prisma-felkoder: https://www.prisma.io/docs/orm/reference/error-reference
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2003") {
        // Foreign key
        return fail(409, "Databasfel (FK). Kontrollera att user/profil stämmer.", true, {
          code: err.code,
          meta: err.meta,
        });
      }
      if (err.code === "P2002") {
        // Unique constraint
        return fail(409, "Databasfel (unik constraint).", true, {
          code: err.code,
          meta: err.meta,
        });
      }
      if (err.code === "P2025") {
        // Record not found
        return fail(404, "Post saknas (P2025).", true, { code: err.code, meta: err.meta });
      }
      return fail(500, "Prisma-fel.", true, { code: err.code, meta: err.meta });
    }

    console.error("[save-onboarding] error:", err);
    const message = err instanceof Error ? err.message : "Ett fel uppstod.";
    return fail(500, message, true);
  }
}
