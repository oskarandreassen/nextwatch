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

// Säker konvertering från okänd JSON till FavoriteItem
function asFavoriteItem(x: unknown): FavoriteItem | null {
  if (!x || typeof x !== "object") return null;
  const obj = x as Record<string, unknown>;
  if (typeof obj.id !== "number") return null;
  if (typeof obj.title !== "string") return null;

  const year =
    typeof obj.year === "string" ? obj.year : obj.year === null ? null : undefined;
  const poster =
    typeof obj.poster === "string" ? obj.poster : obj.poster === null ? null : undefined;

  return { id: obj.id, title: obj.title, year, poster };
}

export default async function ProfilePage() {
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
        favoriteMovie: true,
        favoriteShow: true,
      },
    });

    if (prof) {
      const favoriteGenres = Array.isArray(prof.favoriteGenres)
        ? (prof.favoriteGenres as unknown[]).filter((g): g is string => typeof g === "string")
        : [];

      initial = {
        displayName: prof.displayName ?? null,
        dob: toDateInput((prof.dob as unknown) as Date | string | null),
        region: prof.region ?? null,
        locale: prof.locale ?? null,
        uiLanguage: prof.uiLanguage ?? null,
        favoriteGenres,
        favoriteMovie: asFavoriteItem(prof.favoriteMovie as unknown),
        favoriteShow: asFavoriteItem(prof.favoriteShow as unknown),
      };
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="text-2xl font-semibold mb-4">Profil</h1>
      <ProfileClient initial={initial} />
    </div>
  );
}
