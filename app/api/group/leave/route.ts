// app/api/group/leave/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const store = await cookies();
    const me = store.get("nw_uid")?.value ?? "";
    const code = store.get("nw_group")?.value ?? "";
    if (!me) return NextResponse.json({ ok: false, message: "Not authenticated." }, { status: 401 });

    if (code) {
      await prisma.groupMember.deleteMany({ where: { groupCode: code, userId: me } });
    }

    const res = NextResponse.json({ ok: true, left: true });
    // ta bort cookie
    res.cookies.set({
      name: "nw_group",
      value: "",
      path: "/",
      expires: new Date(0),
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, message: "Internal error." }, { status: 500 });
  }
}
