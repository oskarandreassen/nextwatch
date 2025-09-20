// app/api/ratings/save/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient, Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Enkel, varningsfri Prisma-singleton
let prisma: PrismaClient | undefined;
function getPrisma() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

type Body = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  rating: number; // 1..10
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}
function ok(payload: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: true, ...payload });
}

/** Bygg en Prisma-data för update/create med godtyckligt betygsfältsnamn */
function buildUpdateData(field: "rating" | "score" | "value", rating: number) {
  return ({ [field]: rating } as unknown) as Prisma.RatingUpdateInput;
}
function buildCreateData(
  field: "rating" | "score" | "value",
  rating: number,
  base: { userId: string; tmdbId: number; mediaType: "movie" | "tv" }
) {
  return ({ ...base, [field]: rating } as unknown) as Prisma.RatingCreateInput;
}

export async function POST(req: Request) {
  try {
    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (!uid) return bad("Ingen session hittades (nw_uid saknas).", 401);

    const body = (await req.json()) as Body;
    const tmdbId = Number(body.tmdbId);
    const mediaType = body.mediaType;
    const rating = Number(body.rating);

    if (!Number.isFinite(tmdbId) || (mediaType !== "movie" && mediaType !== "tv")) {
      return bad("Ogiltig payload.");
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
      return bad("Betyg måste vara 1–10.");
    }

    const db = getPrisma();

    // Finns rad redan?
    const existing = await db.rating.findFirst({
      where: { userId: uid, tmdbId, mediaType },
      select: { id: true },
    });

    // Vi försöker i ordning: rating -> score -> value
    const fields: Array<"rating" | "score" | "value"> = ["rating", "score", "value"];

    if (existing) {
      for (const f of fields) {
        try {
          await db.rating.update({
            where: { id: existing.id },
            data: buildUpdateData(f, rating),
          });
          return ok();
        } catch {
          // prova nästa fält
        }
      }
      return bad("Prisma-fel: Hittade inget kompatibelt betygsfält.", 500);
    } else {
      const base = { userId: uid, tmdbId, mediaType };
      for (const f of fields) {
        try {
          await db.rating.create({
            data: buildCreateData(f, rating, base),
          });
          return ok();
        } catch {
          // prova nästa fält
        }
      }
      return bad("Prisma-fel: Hittade inget kompatibelt betygsfält.", 500);
    }
  } catch (err) {
    console.error("ratings/save error", err);
    return bad("Prisma-fel.", 500);
  }
}
