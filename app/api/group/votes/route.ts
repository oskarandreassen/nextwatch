// app/api/group/vote/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Body = {
  tmdbId: number;
  tmdbType: "movie" | "tv";
  vote: "LIKE" | "DISLIKE" | "SKIP";
  groupCode?: string;
};

type Ok = { ok: true };
type Err = { ok: false; message: string };

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." } as Err, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, message: "Ogiltig JSON." } as Err, { status: 400 });
  }

  const code = body.groupCode ?? jar.get("nw_group")?.value ?? null;
  if (!code) return NextResponse.json({ ok: false, message: "Ingen grupp." } as Err, { status: 400 });

  if (!Number.isFinite(body.tmdbId) || (body.tmdbType !== "movie" && body.tmdbType !== "tv")) {
    return NextResponse.json({ ok: false, message: "Ogiltig TMDB-data." } as Err, { status: 400 });
  }
  if (!["LIKE", "DISLIKE", "SKIP"].includes(body.vote)) {
    return NextResponse.json({ ok: false, message: "Ogiltig röst." } as Err, { status: 400 });
  }

  await prisma.$executeRaw`
    INSERT INTO group_votes (group_code, user_id, tmdb_id, tmdb_type, vote, decided_at)
    VALUES (${code}, ${uid}, ${body.tmdbId}, ${body.tmdbType}, ${body.vote}, NOW())
    ON CONFLICT (group_code, user_id, tmdb_id, tmdb_type)
    DO UPDATE SET vote = EXCLUDED.vote, decided_at = NOW()
  `;

  return NextResponse.json({ ok: true } as Ok);
}
