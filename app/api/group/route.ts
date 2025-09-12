// app/api/group/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../lib/prisma";

// 6-teckenskod (utan lättförväxlade tecken)
function genCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** GET /api/group?code=XXXXXX */
export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get("code")?.toUpperCase() ?? null;
    if (!code) {
      return NextResponse.json({ ok: false, error: "Missing ?code" }, { status: 400 });
    }

    // Prisma-modellen är singular: prisma.group
    const group = await prisma.group.findUnique({ where: { code } });
    if (!group) {
      return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, group }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

/** POST /api/group  Body: {}  -> skapar grupp med creator = nuvarande anonym user */
export async function POST() {
  try {
    // 1) Säkerställ anonym session (nw_uid)
    const cookieStore = await cookies();
    let anonId = cookieStore.get("nw_uid")?.value;

    if (!anonId) {
      // Skapa en ny och sätt cookie
      anonId = crypto.randomUUID();
      cookieStore.set({
        name: "nw_uid",
        value: anonId,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // (valfri) expires: ...
      });
    }

    // 2) Upserta användare på anonId (anpassad till ditt schema: User.anonId @unique)
    const user = await prisma.user.upsert({
      where: { anonId },
      update: {},
      create: { anonId },
      select: { id: true },
    });

    // 3) Generera unik kod
    let code = genCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.group.findUnique({ where: { code } });
      if (!exists) break;
      code = genCode();
    }

    // 4) Skapa gruppen och koppla creator → user.id
    // Viktigt: Din Prisma-modell `Group` har ett obligatoriskt relationsfält `creator`
    // vilket gör att vi måste skicka med connect: { id: user.id } här.
    const group = await prisma.group.create({
      data: {
        code,
        creator: { connect: { id: user.id } },
      },
    });

    return NextResponse.json({ ok: true, group }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
