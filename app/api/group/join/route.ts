// app/api/group/join/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

export async function POST(req: Request) {
  const { code: raw } = await req.json().catch(() => ({ code: "" }));
  const code = (raw || "").toUpperCase().trim();
  if (!/^[A-Z0-9]{4,10}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 400 });
  }

  // se till att user finns
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
  const user = await prisma.user.upsert({
    where: { id: uid },
    update: {},
    create: { id: uid, plan: "free" },
    select: { id: true },
  });

  const group = await prisma.group.findUnique({ where: { code }, select: { code: true } });
  if (!group) return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });

  await prisma.groupMember.upsert({
    where: { groupCode_userId: { groupCode: code, userId: user.id } },
    update: {},
    create: { groupCode: code, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
