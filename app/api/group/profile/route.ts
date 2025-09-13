import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code") || "";
    if (!code) return NextResponse.json({ ok: false, error: "Missing ?code" }, { status: 400 });

    const members = await prisma.groupMember.findMany({
      where: { groupCode: code },
      include: { user: { include: { profile: true } } },
    });

    const counts = new Map<string, number>();
    const dislikes = new Set<string>();

    for (const m of members) {
      const p = m.user.profile;
      if (!p) continue;
      for (const g of p.favoriteGenres) counts.set(g, (counts.get(g) || 0) + 1);
      for (const g of p.dislikedGenres) dislikes.add(g);
    }

    const ranked = Array.from(counts.entries())
      .filter(([g]) => !dislikes.has(g))
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g);

    return NextResponse.json({ ok: true, topGenres: ranked, members: members.length });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
