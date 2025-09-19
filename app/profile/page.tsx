// app/profile/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import ProfileClient from "./ProfileClient";

export type FavoriteItem = {
  id: number;
  title: string;
  year?: string | null;
  poster?: string | null;
};

export type ProfileDTO = {
  displayName: string | null;
  dob: string | null; // ISO yyyy-mm-dd eller null
  region: string | null;
  locale: string | null;
  uiLanguage: string | null;
  favoriteGenres: string[];
  dislikedGenres?: string[]; // valfri – klient hydr. ändå
  providers?: string[];      // valfri – klient hydr. ändå
  favoriteMovie?: FavoriteItem | null;
  favoriteShow?: FavoriteItem | null;
};

function toDateInput(d: Date | string | null): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "";
  const yyyy = String(dt.getFullYear());
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function asFavoriteItem(x: unknown): FavoriteItem | null {
  if (!x || typeof x !== "object") return null;
  const obj = x as Record<string, unknown>;
  if (typeof obj.id !== "number") return null;
  if (typeof obj.title !== "string") return null;

  const year =
    typeof obj.year === "string" ? obj.year : obj.year === null ? null : undefined;
  const poster =
    typeof obj.poster === "string" ? obj.poster : obj.poster === null ? null : undefined;

  const out: Record<string, unknown> = { id: obj.id, title: obj.title };
  if (typeof year !== "undefined") out.year = year;
  if (typeof poster !== "undefined") out.poster = poster;
  return out as FavoriteItem;
}

export default async function Page() {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;

  let initial: ProfileDTO | null = null;

  if (uid) {
    const prof = await prisma.profile.findUnique({
      where: { userId: uid },
      select: {
        displayName: true,
        dob: true,
        region: true,
        locale: true,
        uiLanguage: true,
        favoriteGenres: true,
        dislikedGenres: true,
        providers: true,
        favoriteMovie: true,
        favoriteShow: true,
      },
    });

    if (prof) {
      const favoriteGenres = Array.isArray(prof.favoriteGenres)
        ? (prof.favoriteGenres as unknown[]).filter(
            (g): g is string => typeof g === "string"
          )
        : [];
      const dislikedGenres = Array.isArray(prof.dislikedGenres)
        ? (prof.dislikedGenres as unknown[]).filter(
            (g): g is string => typeof g === "string"
          )
        : [];
      const providers = Array.isArray(prof.providers)
        ? (prof.providers as unknown[]).filter(
            (g): g is string => typeof g === "string"
          )
        : [];

      initial = {
        displayName: prof.displayName ?? null,
        dob: prof.dob ? toDateInput(prof.dob) : null,
        region: prof.region ?? null,
        locale: prof.locale ?? null,
        uiLanguage: prof.uiLanguage ?? null,
        favoriteGenres,
        dislikedGenres,
        providers,
        favoriteMovie: asFavoriteItem(prof.favoriteMovie as unknown),
        favoriteShow: asFavoriteItem(prof.favoriteShow as unknown),
      };
    }
  }

  return <ProfileClient initial={initial} />;
}
