// app/api/profile/route.ts
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import prisma from "../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firstAcceptLanguage(h: string | null): string | null {
  if (!h) return null;
  const first = h.split(",")[0]?.trim();
  return first || null;
}

async function inferRegionAndLocale(): Promise<{ region: string; locale: string }> {
  const jar = await cookies();
  const hdr = await headers();
  const ipCountry = hdr.get("x-vercel-ip-country");
  const acceptLang = firstAcceptLanguage(hdr.get("accept-language"));

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

export async function GET() {
  const cookieStore = await cookies();
  const uid = cookieStore.get("nw_uid")?.value || null;
  if (!uid) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

  const profile = await prisma.profile.findUnique({ where: { userId: uid } });
  return NextResponse.json({ ok: true, profile });
}

export async function PUT(req: Request) {
  const cookieStore = await cookies();
  const uid = cookieStore.get("nw_uid")?.value || null;
  if (!uid) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

  const body = (await req.json()) as Record<string, unknown>;

  const asStringArray = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);
  const asString = (x: unknown): string | null => (typeof x === "string" && x.trim() !== "" ? x.trim() : null);

  const displayName = asString(body.displayName);
  const dobStr = asString(body.dob); // kan vara null -> vi sätter bara om det finns
  const favoriteGenres = asStringArray(body.favoriteGenres);
  const dislikedGenres = asStringArray(body.dislikedGenres);
  const providers = asStringArray(body.providers);

  const { region, locale } = await inferRegionAndLocale();
  const uiLanguageRaw = asString(body.uiLanguage);
  const uiLanguage = uiLanguageRaw ? uiLanguageRaw : (locale.split("-")[0] || "sv");

  // Finns profil → UPDATE; annars CREATE (kräver dob & displayName)
  const existing = await prisma.profile.findUnique({ where: { userId: uid } });

  if (existing) {
    const updated = await prisma.profile.update({
      where: { userId: uid },
      data: {
        displayName: typeof displayName === "string" ? displayName : undefined,
        dob: dobStr ? new Date(dobStr) : undefined, // ❗️bara sätta om given
        region,
        locale,
        uiLanguage,
        favoriteGenres,
        dislikedGenres,
        providers,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, profile: updated });
  }

  if (!displayName || !dobStr) {
    return NextResponse.json(
      { ok: false, error: "displayName och dob krävs för att skapa profilen." },
      { status: 400 }
    );
  }

  const created = await prisma.profile.create({
    data: {
      userId: uid,
      displayName,
      dob: new Date(dobStr), // ✅ obligatoriskt i create om din schema kräver det
      region,
      locale,
      uiLanguage,
      favoriteGenres,
      dislikedGenres,
      providers,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, profile: created });
}
