// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function j(status: number, message: string, extra?: Record<string, unknown>) {
  const body: Record<string, unknown> = { ok: false, message };
  if (extra) body.extra = extra;
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) return j(401, "Ingen session. Logga in igen.");

    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email || "").trim().toLowerCase();
    const password = (body.password || "").trim();
    if (!email || !password) return j(400, "E-post och lösenord krävs.");

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true },
    });
    if (!user) return j(401, "Ogiltig session. Användare saknas.", { uid });

    // upptagen e-post?
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: uid } },
      select: { id: true },
    });
    if (taken) return j(409, "E-postadressen används redan.");

    const hash = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: uid },
        data: {
          email,
          passwordHash: hash, // @map("password_hash")
        },
      }),
      prisma.verification.create({
        data: {
          token,
          userId: uid, // @map("user_id")
          email,
          name: null,
          expiresAt, // @map("expires_at")
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Konto uppdaterat. Verifieringslänk skapad.",
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // returnera kod + meta så vi ser exakt vad som händer
      return j(500, `Databasfel (${err.code}).`, {
        code: err.code,
        meta: err.meta,
      });
    }
    console.error("[auth/register] error:", err);
    const msg = err instanceof Error ? err.message : "Internt fel.";
    return j(500, msg);
  }
}
