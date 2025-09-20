// app/api/ratings/save/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

type SaveBody = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  rating: number; // 1..10
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export async function POST(req: Request) {
  try {
    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (!uid) return bad("Ingen session (nw_uid saknas).", 401);

    const body = (await req.json()) as SaveBody;
    const tmdbId = Number(body.tmdbId);
    const mediaType = body.mediaType;
    const rating = Number(body.rating);

    if (!Number.isFinite(tmdbId) || tmdbId <= 0) return bad("Ogiltigt tmdbId.");
    if (mediaType !== "movie" && mediaType !== "tv") return bad("Ogiltig mediaType.");
    if (!Number.isFinite(rating) || rating < 1 || rating > 10) return bad("rating måste vara 1–10.");

    // Säkerställ kolumnen finns (idempotent) – påverkar inte performance märkbart
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'ratings'
            AND column_name  = 'rating'
        ) THEN
          ALTER TABLE public.ratings
            ADD COLUMN rating INT CHECK (rating BETWEEN 1 AND 10);
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name   = 'ratings'
            AND column_name  = 'decided_at'
        ) THEN
          ALTER TABLE public.ratings
            ADD COLUMN decided_at TIMESTAMP NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'ratings_user_tmdb_media_unique'
        ) THEN
          ALTER TABLE public.ratings
          ADD CONSTRAINT ratings_user_tmdb_media_unique UNIQUE (user_id, tmdb_id, media_type);
        END IF;
      END$$;
    `);

    // Upsert via rå SQL för att slippa Prisma-modellens exakta fältnamn just nu.
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO public.ratings (user_id, tmdb_id, media_type, rating, decided_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id, tmdb_id, media_type)
      DO UPDATE SET rating = EXCLUDED.rating, decided_at = NOW();
    `,
      uid,
      tmdbId,
      mediaType,
      rating
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("ratings/save error:", err);
    return NextResponse.json({ ok: false, message: "Prisma-fel: Hittade inget kompatibelt betygsfält." }, { status: 500 });
  }
}
