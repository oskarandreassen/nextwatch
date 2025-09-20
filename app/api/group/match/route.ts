// app/api/group/match/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 60%-regeln med rimligt minsta krav (2) */
function likeThreshold(n: number): number {
  if (n <= 2) return 2;
  return Math.ceil(0.6 * n);
}

type MatchItem = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  likes: number;
};

type ApiOk = {
  ok: true;
  size: number;           // antal medlemmar i gruppen
  need: number;           // likes som krävs för match
  count: number;          // antal matcher
  match: MatchItem | null; // toppmatch (för enkel overlay)
  matches: MatchItem[];    // alla matcher sorterade (flest likes först)
};

type ApiErr = { ok: false; error: string };

export async function GET(req: Request) {
  // Följ regeln: anropa cookies() i App Router
  await cookies();

  try {
    const u = new URL(req.url);
    const code = (u.searchParams.get("code") || "").toUpperCase();
    if (!code) {
      return NextResponse.json({ ok: false, error: "missing code" } as ApiErr, { status: 400 });
    }

    // Hämta medlemmar → storlek på gruppen
    const members = await prisma.groupMember.findMany({
      where: { groupCode: code },
      select: { userId: true },
    });
    const ids = members.map((m) => m.userId);
    const n = ids.length;
    if (n === 0) {
      const empty: ApiOk = { ok: true, size: 0, need: 0, count: 0, match: null, matches: [] };
      return NextResponse.json(empty);
    }

    // Läs alla röster i gruppen (LIKE/DISLIKE/SKIP), men vi bryr oss om LIKE/DISLIKE
    const votes = await prisma.groupVote.findMany({
      where: { groupCode: code },
      select: { userId: true, tmdbId: true, tmdbType: true, vote: true },
    });

    // Aggregat per (tmdbId, tmdbType)
    const key = (id: number, t: "movie" | "tv") => `${id}:${t}`;
    const likes = new Map<string, Set<string>>();
    const dislikes = new Map<string, Set<string>>();

    for (const v of votes) {
      // Vi följer samma logik som tidigare: en enda DISLIKE blockerar matchen
      const k = key(v.tmdbId, v.tmdbType as "movie" | "tv");
      if (v.vote === "LIKE") {
        if (!likes.has(k)) likes.set(k, new Set());
        likes.get(k)!.add(v.userId);
      } else if (v.vote === "DISLIKE") {
        if (!dislikes.has(k)) dislikes.set(k, new Set());
        dislikes.get(k)!.add(v.userId);
      }
    }

    const need = likeThreshold(n);
    const matches: MatchItem[] = [];

    for (const [k, set] of likes.entries()) {
      const [idStr, mt] = k.split(":");
      const likeCount = set.size;
      if (likeCount < need) continue;
      // Blockera objekt där någon i gruppen aktivt ogillat
      if ((dislikes.get(k)?.size ?? 0) > 0) continue;

      matches.push({
        tmdbId: Number(idStr),
        mediaType: mt as "movie" | "tv",
        likes: likeCount,
      });
    }

    matches.sort((a, b) => b.likes - a.likes);

    const body: ApiOk = {
      ok: true,
      size: n,
      need,
      count: matches.length,
      match: matches[0] ?? null, // <— för enklare overlay-klient
      matches,
    };

    return NextResponse.json(body);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg } as ApiErr, { status: 500 });
  }
}
