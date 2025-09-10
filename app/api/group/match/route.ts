import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function likeThreshold(n: number) {
  if (n <= 2) return 2;
  return Math.ceil(0.6 * n); // 50% + 10% ≈ 60%
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url);
    const code = (u.searchParams.get("code") || "").toUpperCase();
    if (!code) return NextResponse.json({ ok:false, error:"missing code" }, { status:400 });

    const members = await prisma.groupMember.findMany({ where:{ groupCode: code } });
    const ids = members.map(m=>m.userId);
    const n = ids.length;
    if (!n) return NextResponse.json({ ok:true, count:0, matches:[] });

    const rows = await prisma.rating.findMany({ where:{ userId: { in: ids } } });
    type Key = string; // `${tmdbId}:${mediaType}`
    const likes = new Map<Key, Set<string>>();
    const dislikes = new Map<Key, Set<string>>();

    for (const r of rows) {
      const k = `${r.tmdbId}:${r.mediaType}`;
      if (r.decision === "like") {
        if (!likes.has(k)) likes.set(k, new Set());
        likes.get(k)!.add(r.userId);
      } else if (r.decision === "dislike") {
        if (!dislikes.has(k)) dislikes.set(k, new Set());
        dislikes.get(k)!.add(r.userId);
      }
    }

    const need = likeThreshold(n);
    const matches: Array<{ tmdbId:number; mediaType:"movie"|"tv"; likes:number }> = [];
    for (const [k, set] of likes.entries()) {
      if (set.size < need) continue;
      if (dislikes.get(k)?.size) continue;
      const [idStr, mt] = k.split(":");
      matches.push({ tmdbId: Number(idStr), mediaType: mt as "movie"|"tv", likes: set.size });
    }

    matches.sort((a,b)=> b.likes - a.likes);

    return NextResponse.json({ ok:true, need, size:n, count:matches.length, matches });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok:false, error: msg }, { status:500 });
  }
}
