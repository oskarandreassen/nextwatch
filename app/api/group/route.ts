// app/api/group/route.ts
import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

// Skapa kort 6-teckenskod (utan lättförväxlade tecken)
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

    const group = await prisma.groups.findUnique({ where: { code } });
    if (!group) return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });

    return NextResponse.json({ ok: true, group }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

/** POST /api/group  Body: { name?: string } */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : null;

    // generera unik kod (försök några gånger)
    let code = genCode();
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.groups.findUnique({ where: { code } });
      if (!exists) break;
      code = genCode();
    }

    const group = await prisma.groups.create({ data: { code, name } });
    return NextResponse.json({ ok: true, group }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
