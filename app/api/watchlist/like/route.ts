import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto"; // ← genererar id om modellen kräver det

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title?: string;
  year?: string | null;
  poster?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return NextResponse.json({ ok: false, message: "Ingen session" }, { status: 401 });
    }

    const body = (await req.json()) as Body;
    if (!body?.tmdbId || !body.mediaType) {
      return NextResponse.json({ ok: false, message: "Ogiltig payload" }, { status: 400 });
    }

    // Finns redan i watchlist?
    const existing = await prisma.watchlist.findFirst({
      where: { userId: uid, tmdbId: body.tmdbId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true });
    }

    // Skapa – inkluderar id då modellen kräver det
    await prisma.watchlist.create({
      data: {
        id: randomUUID(),          // ★ fixar TS-2322 (id saknades)
        userId: uid,
        tmdbId: body.tmdbId,
        mediaType: body.mediaType, // om detta är en Prisma-enum i din modell, är värdet ändå "movie" | "tv"
        // Lägg gärna till dessa om kolumnerna finns i din modell (annars lämna bort dem):
        // title: body.title ?? undefined,
        // year: body.year ?? undefined,
        // poster: body.poster ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Internt fel";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
