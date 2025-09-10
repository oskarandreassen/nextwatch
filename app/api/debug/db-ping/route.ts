import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await prisma.$queryRaw<{ x: number }[]>`SELECT 1 as x`;
    return NextResponse.json({
      ok: true,
      x: r[0]?.x ?? null,
      hasDb: Boolean(process.env.DATABASE_URL),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
