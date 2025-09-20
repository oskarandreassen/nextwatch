// app/api/cron/cleanup/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret") ?? "";
  return header === secret;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Radera grupper äldre än 1 dag som saknar medlemmar
  const deleted = await prisma.group.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      members: { none: {} },
    },
  });

  return NextResponse.json({ ok: true, deleted: deleted.count });
}
