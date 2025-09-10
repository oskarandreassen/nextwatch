import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function newId() { return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2); }

export async function POST(req: Request) {
  try {
    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status:400 });

    const { tmdbId, mediaType, add } = (await req.json()) as { tmdbId:number; mediaType:"movie"|"tv"; add:boolean };

    if (add) {
      // UNIQUE(user_id, tmdb_id, media_type) finns – skapa eller ignorera
      try {
        await prisma.watchlist.create({ data:{ id: newId(), userId: uid, tmdbId, mediaType } });
      } catch { /* redan finns */ }
    } else {
      await prisma.watchlist.deleteMany({ where:{ userId: uid, tmdbId, mediaType } });
    }
    return NextResponse.json({ ok:true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok:false, error: msg }, { status:400 });
  }
}
