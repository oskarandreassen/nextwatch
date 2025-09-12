// app/api/group/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../lib/prisma";

// 6-teckenskod utan lättförväxlade tecken
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
    if (!code) return NextResponse.json({ ok: false, error: "Missing ?code" }, { status: 400 });

    // Prisma-modellen är singular
    const group = await prisma.group.findUnique({ where: { code } });
    if (!group) return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });

    return NextResponse.json({ ok: true, group }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

/** POST /api/group  Body: {}  -> skapar grupp och kopplar creator */
export async function POST() {
  try {
    // 1) Läs/sätt nw_uid
    const cookieStore = await cookies();
    let uid = cookieStore.get("nw_uid")?.value;
    if (!uid) {
      uid = crypto.randomUUID();
      cookieStore.set({
        name: "nw_uid",
        value: uid,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });
    }

    // 2) Säkerställ att en User finns med id = uid (din User.id saknar default)
    const user = await prisma.user.upsert({
      where: { id: uid },
      update: {},
      create: { id: uid, plan: "free" },
      select: { id: true },
    });

    // 3) Generera unik kod
    let code = genCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.group.findUnique({ where: { code } });
      if (!exists) break;
      code = genCode();
    }

    // 4) Skapa gruppen och koppla creator → user.id (krävs av ditt schema)
    const group = await prisma.group.create({
      data: {
        code,
        creator: { connect: { id: user.id } }, // sätter createdBy under huven
      },
    });

    return NextResponse.json({ ok: true, group }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
