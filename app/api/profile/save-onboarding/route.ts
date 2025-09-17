// app/api/profile/save-onboarding/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
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

// ——— DOB extraction ———
function extractDob(body: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    body.dob,
    body.dateOfBirth,
    body.birthdate,
    body.birthday,
    body.dobISO,
    body.birth_date,
  ];

  const nestedPaths: string[][] = [
    ["profile", "dob"],
    ["form", "dob"],
    ["data", "dob"],
    ["profile", "dateOfBirth"],
    ["profile", "birthdate"],
    ["values", "dob"],
  ];
  for (const path of nestedPaths) {
    let cur: unknown = body;
    for (const key of path) {
      if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    if (cur !== undefined) candidates.push(cur);
  }

  // Objekt {year,month,day}
  const ymdObj = candidates.find(
    (c): c is { year: string | number; month: string | number; day: string | number } =>
      typeof c === "object" && c !== null && "year" in c && "month" in c && "day" in c
  );
  if (ymdObj) {
    const y = String(ymdObj.year).padStart(4, "0");
    const m = String(ymdObj.month).padStart(2, "0");
    const d = String(ymdObj.day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Första string
  const first = candidates.find(
    (c): c is string => typeof c === "string" && c.trim().length > 0
  );
  if (!first) return null;

  const s = first.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const s1 = s.replace(/[/.]/g, "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s1)) return s1;

  const sv = s.replace(/[.]/g, "/");
  const m = sv.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const yyyy = String(dt.getFullYear());
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

// Centraliserad felrespons
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

// —— Region/Locale helpers ——
function firstAcceptLanguage(h: string | null): string | null {
  if (!h) return null;
  const first = h.split(",")[0]?.trim();
  return first || null;
}

async function inferRegionAndLocale(): Promise<{ region: string; locale: string }> {
  const jar = await cookies();
  const hdr = await headers();

  const ipCountry = hdr.get("x-vercel-ip-country"); // ex. "SE" på Vercel
  const acceptLang = firstAcceptLanguage(hdr.get("accept-language")); // ex. "sv-SE"

  const region =
    jar.get("nw_region")?.value ||
    (ipCountry && /^[A-Z]{2}$/.test(ipCountry) ? ipCountry : null) ||
    "SE";

  const locale =
    jar.get("nw_locale")?.value ||
    (acceptLang && /^[a-z]{2}(-[A-Z]{2})?$/.test(acceptLang) ? acceptLang : null) ||
    "sv-SE";

  return { region, locale };
}

// ——— Route ———
export async function POST(req: NextRequest) {
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  try {
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return fail(401, "Ingen session hittades (nw_uid saknas).", debug);
    }

    const body = (await req.json()) as Record<string, unknown>;

    const displayName = (body.displayName as string | undefined)?.trim();
    const bodyRegion = (body.region as string | undefined)?.trim();
    const bodyLocale = (body.locale as string | undefined)?.trim();
    const bodyUiLanguage = (body.uiLanguage as string | undefined)?.trim();
    const providers = body.providers;
    const favoriteMovie = body.favoriteMovie;
    const favoriteShow = body.favoriteShow;
    const favoriteGenres = (body.favoriteGenres as string[] | undefined) ?? [];
    const dislikedGenres = (body.dislikedGenres as string[] | undefined) ?? [];

    const dobStr = extractDob(body);

    // Härled region/locale från cookies/headers, men tillåt body att override:a om satt
    const inferred = await inferRegionAndLocale();
    const finalRegion =
      bodyRegion && bodyRegion.length === 2 ? bodyRegion : inferred.region;
    const finalLocale =
      bodyLocale && bodyLocale.length >= 2 ? bodyLocale : inferred.locale;
    const finalUiLanguage =
      bodyUiLanguage && bodyUiLanguage.length > 0
        ? bodyUiLanguage
        : (finalLocale.split("-")[0] || "sv");

    const missing: string[] = [];
    if (!displayName) missing.push("displayName");
    if (!dobStr) missing.push("dob");
    // OBS: region/locale lämnas utanför eftersom vi härleder dem automatiskt
    if (missing.length) {
      return fail(400, `Obligatoriska fält saknas: ${missing.join(", ")}`, debug, {
        receivedKeys: Object.keys(body),
      });
    }

    

    const dobDate: Date = new Date(dobStr as string);

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true },
    });
    if (!user) {
      return fail(401, "Ogiltig session: användaren finns inte.", debug, {
        uidFromCookie: uid,
      });
    }

    const favMovieJson = normalizeFavorite(favoriteMovie);
    const favShowJson = normalizeFavorite(favoriteShow);
    const providersJson = toProvidersJson(providers);

    const updateData: Prisma.ProfileUpdateInput = {
      displayName,
      region: finalRegion,
      locale: finalLocale,
      uiLanguage: finalUiLanguage,
      providers: providersJson,
      favoriteMovie: favMovieJson,
      favoriteShow: favShowJson,
      favoriteGenres,
      dislikedGenres,
      updatedAt: new Date(),
    };

    const createData: Prisma.ProfileCreateInput = {
      user: { connect: { id: uid } },
      dob: dobDate,
      displayName,
      region: finalRegion,
      locale: finalLocale,
      uiLanguage: finalUiLanguage,
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

    // Sätt cookies så resten av appen använder samma region/locale
    const res = NextResponse.json({ ok: true, profile: saved });
    res.cookies.set("nw_region", finalRegion, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    res.cookies.set("nw_locale", finalLocale, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return fail(500, "Prisma-fel.", true, { code: err.code, meta: err.meta });
    }
    console.error("[save-onboarding] error:", err);
    const message = err instanceof Error ? err.message : "Ett fel uppstod.";
    return fail(500, message, true);
  }
}
