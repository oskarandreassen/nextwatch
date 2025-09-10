import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const r = await prisma.$queryRaw<{ x:number }[]>`SELECT 1 as x`;
    return NextResponse.json({ ok:true, x:r[0]?.x ?? null, hasDb: !!process.env.DATABASE_URL });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status: 500 });
  }
}
