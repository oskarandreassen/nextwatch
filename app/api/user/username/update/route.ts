// app/api/user/username/update/route.ts
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

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });

  type Body = { username?: string };
  const body = (await req.json()) as unknown;
  const usernameRaw = typeof (body as Body)?.username === "string" ? (body as Body).username : null;
  const username = normalizeUsername(usernameRaw);

  if (!username) {
    return NextResponse.json({ ok: false, message: "Ogiltigt användarnamn." }, { status: 400 });
  }

  const taken = await prisma.user.findFirst({
    where: { username, NOT: { id: uid } },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json({ ok: false, message: "Upptaget." }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: uid },
    data: { username },
  });

  return NextResponse.json({ ok: true, username });
}
