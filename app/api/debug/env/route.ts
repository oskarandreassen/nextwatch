import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mask(s?: string | null, keep = 6) {
  if (!s) return null;
  const head = s.slice(0, keep);
  const tail = s.length > keep ? `...(${s.length})` : "";
  return `${head}${tail}`;
}

export async function GET() {
  const v4 = process.env.TMDB_V4_TOKEN || null;
  const v3 = process.env.TMDB_API_KEY || null;

  return NextResponse.json({
    ok: true,
    has_v4: !!v4,
    v4_preview: mask(v4),   // visar bara första tecknen + längd
    has_v3: !!v3,
    v3_preview: mask(v3)
  });
}
