// app/api/group/my-friends/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const uid = cookies().get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

    // Hitta alla grupper där jag är medlem
    const myMemberships = await prisma.groupMember.findMany({
      where: { userId: uid },
      select: { groupCode: true },
    });
    const codes = [...new Set(myMemberships.map((m) => m.groupCode))];
    if (codes.length === 0) return NextResponse.json({ ok: true, friends: [] });

    // Hämta andra medlemmar i dessa grupper
    const others = await prisma.groupMember.findMany({
      where: { groupCode: { in: codes }, NOT: { userId: uid } },
      include: { user: true },
    });

    const byId = new Map<string, { userId: string; displayName: string; initials: string }>();
    for (const m of others) {
      const email = m.user.email ?? "";
      const displayBase = email ? email.split("@")[0] : `User-${m.userId.slice(0, 6)}`;
      const displayName = displayBase.charAt(0).toUpperCase() + displayBase.slice(1);
      const initials = displayName
        .split(/\s+/)
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      if (!byId.has(m.userId)) byId.set(m.userId, { userId: m.userId, displayName, initials });
    }

    return NextResponse.json({ ok: true, friends: Array.from(byId.values()) });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
