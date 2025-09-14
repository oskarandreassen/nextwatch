import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import prisma from "../../../../lib/prisma";
import { sendVerificationEmail } from "../../../../lib/email";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, name } = (await req.json()) as { email?: string; name?: string };
    if (!email) return NextResponse.json({ ok: false, error: "Email required" }, { status: 400 });

    const cookieStore = await cookies();
    const uid = cookieStore.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok: false, error: "No session" }, { status: 401 });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

    await prisma.verification.upsert({
      where: { token },
      update: {},
      create: { token, userId: uid, email, name, expiresAt },
    });

    const base = process.env.NEXT_PUBLIC_BASE_URL || "";
    const link = `${base}/auth/verify?token=${encodeURIComponent(token)}`;
    await sendVerificationEmail(email, link);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
