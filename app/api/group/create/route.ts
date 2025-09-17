// app/api/groups/create/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import crypto from "node:crypto";

type Body = {
  name?: string;
};

function genCode(): string {
  // 6 tecken A-Z0-9
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i += 1) {
    const idx = crypto.randomInt(0, alphabet.length);
    s += alphabet[idx];
  }
  return s;
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });

  // name tas emot men lagras ej (schema saknar fält) — behåll för framtida bruk
  const _body = (await req.json()) as Body;
  let code = genCode();

  // säkerställ unik kod
  for (let i = 0; i < 5; i += 1) {
    const exists = await prisma.group.findUnique({ where: { code } });
    if (!exists) break;
    code = genCode();
  }

  const group = await prisma.group.create({
    data: {
      code,
      createdBy: uid,
      members: {
        create: { userId: uid },
      },
    },
    select: { code: true, createdAt: true, createdBy: true },
  });

  const res = NextResponse.json({ ok: true, group });
  res.cookies.set({
    name: "nw_group",
    value: group.code,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
