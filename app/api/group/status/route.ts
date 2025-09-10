import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ageFromDob(d: Date) {
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
function seMaxCert(age: number) {
  if (age >= 15) return "15";
  if (age >= 11) return "11";
  if (age >= 7) return "7";
  return "0";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = (url.searchParams.get("code") || "").toUpperCase();
  const c = await cookies();
  const uid = c.get("nw_uid")?.value;
  if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status:400 });
  if (!code) return NextResponse.json({ ok:false, error:"missing code" }, { status:400 });

  const grp = await prisma.group.findUnique({ where:{ code } });
  if (!grp) return NextResponse.json({ ok:false, error:"not found" }, { status:404 });

  const members = await prisma.groupMember.findMany({ where:{ groupCode: code } });
  const ids = members.map(m=>m.userId);
  const profiles = await prisma.profile.findMany({ where:{ userId: { in: ids } } });
  const users = await prisma.user.findMany({ where:{ id: { in: ids } } });

  // intersektion av providers
  const lists = profiles.map(p => Array.isArray(p.providers) ? (p.providers as unknown as string[]) : []);
  const intersection = lists.length
    ? lists.reduce((acc,arr) => acc.filter(x => arr.includes(x))) 
    : [];

  // striktast cert (yngstas ålder)
  const minAge = profiles.length ? Math.min(...profiles.map(p => ageFromDob(new Date(p.dob)))) : 18;
  const certMax = seMaxCert(minAge);

  const hasLifetime = users.some(u => (u.plan ?? "free") === "lifetime");

  return NextResponse.json({
    ok:true,
    code,
    size: ids.length,
    providersIntersection: intersection,
    certMax,
    hasLifetime
  });
}
