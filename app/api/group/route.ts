// app/api/group/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

// Skapar en 6-teckenskod A-Z/0-9
function genCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // utan lättförväxlade tecken
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * GET /api/group?code=XXXXXX
 * Enkel echo/info – användbar för hälsokoll eller att hämta gruppen.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.toUpperCase() ?? null;

    if (!code) {
      return NextResponse.json({ ok: false, error: "Missing ?code" }, { status: 400 });
    }

    const group = await prisma.groups.findUnique({
      where: { code },
    });

    if (!group) {
      return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, group }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/group
 * Body: { name?: string }
 * Skapar en grupp med unik kod. Associerar ej ännu till användare (kan läggas till senare).
 */
export async function POST(req: Request) {
  try {
    // (valfritt) hämta anonym session-id om du vill binda skaparen; inget krav för MVP
    const cookieStore = await cookies();
    const uid = cookieStore.get("nw_uid")?.value ?? null;

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : null;

    // Skapa unik kod
    let code = genCode();
    // Säkerställ unikhet (enkel loop, låg sannolikhet för kollision)
    // Vid extrem otur försöker vi några gånger
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.groups.findUnique({ where: { code } });
      if (!exists) break;
      code = genCode();
    }

    const group = await prisma.groups.create({
      data: {
        code,
        name,
        // Lägg till fält om ditt schema har fler (t.ex. plan, createdBy, etc.)
      },
    });

    // (valfritt) skapa medlemskap för skaparen om du har user-id
    // if (uid) {
    //   const user = await prisma.users.upsert({
    //     where: { anonId: uid }, // anpassa efter ditt schema
    //     update: {},
    //     create: { anonId: uid },
    //   });
    //   await prisma.group_members.create({
    //     data: { groupId: group.id, userId: user.id, role: "owner" },
    //   });
    // }

    return NextResponse.json({ ok: true, group }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
