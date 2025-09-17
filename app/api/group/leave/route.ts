// app/api/groups/leave/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Body = { code?: string };

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });

  const body = (await req.json()) as Body;
  const code = (body.code ?? "").trim().toUpperCase();
  if (code.length < 4) return NextResponse.json({ ok: false, message: "Ogiltig kod." }, { status: 400 });

  // Ta bort medlemskap om det finns
  await prisma.groupMember.deleteMany({
    where: { groupCode: code, userId: uid },
  });

  // Om aktiv cookie pekar på samma grupp — ta bort den
  const res = NextResponse.json({ ok: true });
  const current = jar.get("nw_group")?.value ?? null;
  if (current === code) {
    res.cookies.set({
      name: "nw_group",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return res;
}
