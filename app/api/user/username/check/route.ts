// app/api/user/username/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeUsername(u: string | null): string | null {
  if (!u) return null;
  const s = u.trim().toLowerCase();
  if (s.length < 3 || s.length > 20) return null;
  if (!/^[a-z0-9_]+$/.test(s)) return null;
  return s;
}

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("u");
  const candidate = normalizeUsername(q);
  if (!candidate) {
    return NextResponse.json({ ok: true, available: false, message: "Invalid username" }, { status: 200 });
  }

  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;

  const existing = await prisma.user.findFirst({
    where: { username: candidate },
    select: { id: true },
  });

  const available = !existing || (uid !== null && existing.id === uid);
  return NextResponse.json({ ok: true, available });
}
