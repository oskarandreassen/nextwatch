// app/api/groups/members/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import prisma from "@/lib/prisma";

type PublicMember = {
  id: string;
  username: string | null;
  displayName: string | null;
  providers: string[];
};

function getRegionFromHeaders(h: Headers): string | null {
  const vercel = h.get("x-vercel-ip-country");
  if (vercel && /^[A-Z]{2}$/.test(vercel)) return vercel;
  const al = h.get("accept-language");
  if (!al) return null;
  const m = al.match(/-([A-Z]{2})/);
  return m?.[1] ?? null;
}

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const hdr = await headers();

  const uid = jar.get("nw_uid")?.value ?? null;
  if (!uid) return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });

  const u = new URL(req.url);
  const code = (u.searchParams.get("code") ?? jar.get("nw_group")?.value ?? "").trim().toUpperCase();
  if (code.length < 4) return NextResponse.json({ ok: false, message: "Ingen grupp angiven." }, { status: 400 });

  // Säkerställ att jag är medlem
  const isMember = await prisma.groupMember.findUnique({
    where: { groupCode_userId: { groupCode: code, userId: uid } },
    select: { userId: true },
  });
  if (!isMember) return NextResponse.json({ ok: false, message: "Du är inte medlem i gruppen." }, { status: 403 });

  const rows = await prisma.groupMember.findMany({
    where: { groupCode: code },
    select: {
      user: {
        select: {
          id: true,
          username: true,
          profile: { select: { displayName: true, providers: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
    take: 200,
  });

  const members: PublicMember[] = rows.map((r) => {
    const provRaw = r.user.profile?.providers;
    const providers = Array.isArray(provRaw)
      ? (provRaw as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    return {
      id: r.user.id,
      username: r.user.username ?? null,
      displayName: r.user.profile?.displayName ?? null,
      providers,
    };
  });

  const region = jar.get("nw_region")?.value ?? getRegionFromHeaders(hdr) ?? "SE";

  return NextResponse.json({ ok: true, group: { code, region }, members }, { status: 200 });
}
