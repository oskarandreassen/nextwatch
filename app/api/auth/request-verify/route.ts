// app/api/auth/request-verify/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import { sendVerificationMail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email: string;
  name?: string;
};

export async function POST(req: Request) {
  try {
    const { email, name }: Body = await req.json();
    if (!email) {
      return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    }

    // Hitta eller skapa user (guest → sätter bara email om saknas)
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { id: randomUUID(), email },
      });
    }

    // Skapa / ersätt token
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await prisma.verification.upsert({
      where: { token },
      update: {},
      create: {
        token,
        userId: user.id,
        email,
        name,
        expiresAt,
      },
    });

    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const link = `${base}/api/auth/request-verify/verify?token=${encodeURIComponent(token)}`;

    await sendVerificationMail(email, link);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
