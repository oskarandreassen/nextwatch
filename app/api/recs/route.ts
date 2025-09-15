// app/api/recs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../lib/prisma";
import { namesToGenreIds, discoverRecommended, trendingFallback } from "../../../lib/tmdb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });

  // antal vi vill returnera (default 100)
  const url = new URL(req.url);
  const limit = Math.max(10, Math.min(200, Number(url.searchParams.get("limit") ?? "100")));

  // hämta profil
  const profile = await prisma.profile.findUnique({
    where: { userId: uid },
    select: {
      region: true,
      locale: true,
      favoriteGenres: true,
      dislikedGenres: true,
    },
  });

  const language = profile?.locale ?? "sv-SE";
  const region = profile?.region ?? "SE";
  const include = namesToGenreIds(profile?.favoriteGenres ?? []);
  const exclude = namesToGenreIds(profile?.dislikedGenres ?? []);

  // hämta discover eller trending
  let items = await (include.length
    ? discoverRecommended({ include, exclude, language, region, pages: Math.ceil(limit / 20 / 2) * 2 })
    : trendingFallback(language));

  if (items.length > limit) items = items.slice(0, limit);

  return NextResponse.json({ ok: true, items });
}
