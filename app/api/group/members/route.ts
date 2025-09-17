// app/api/group/members/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";

type Row = {
  user_id: string;
  group_code: string;
  joined_at: Date;
  username: string | null;
  display_name: string | null;
};

type Ok = {
  ok: true;
  code: string;
  members: Array<{
    userId: string;
    username: string | null;
    displayName: string | null;
    joinedAt: string;
  }>;
};
type Err = { ok: false; message: string };

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." } as Err, { status: 401 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? jar.get("nw_group")?.value ?? "";
  if (!code) return NextResponse.json({ ok: false, message: "Ingen grupp angiven." } as Err, { status: 400 });

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      gm.user_id,
      gm.group_code,
      gm.joined_at,
      u.username,
      p.display_name
    FROM group_members gm
    JOIN users u ON u.id = gm.user_id
    LEFT JOIN profiles p ON p.user_id = gm.user_id
    WHERE gm.group_code = ${code}
    ORDER BY gm.joined_at ASC
  `;

  const members = rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name,
    joinedAt: r.joined_at.toISOString(),
  }));

  const body: Ok = { ok: true, code, members };
  return NextResponse.json(body);
}
