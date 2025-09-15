// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(status: number, message: string, extra?: Record<string, unknown>) {
  const body: Record<string, unknown> = { ok: false, message };
  if (extra) body.debug = extra;
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return fail(401, "Ingen session. Logga in igen.");
    }

    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email || "").trim().toLowerCase();
    const password = (body.password || "").trim();

    if (!email || !password) {
      return fail(400, "E-post och lösenord krävs.");
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true },
    });
    if (!user) {
      return fail(401, "Ogiltig session. Användare saknas.", { uid });
    }

    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: uid } },
      select: { id: true },
    });
    if (taken) return fail(409, "E-postadressen används redan.");

    const hash = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: uid },
        data: {
          email,
          passwordHash: hash, // DB: password_hash
        },
      }),
      prisma.verification.create({
        data: {
          token,
          userId: uid, // DB: user_id
          email,
          name: null,
          expiresAt, // DB: expires_at
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Konto uppdaterat. Verifieringslänk skapad.",
      // devToken: token, // avkommentera för utveckling
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      switch (err.code) {
        case "P2002":
          return fail(409, "E-postadressen används redan (unik constraint).", {
            code: err.code,
            meta: err.meta,
          });
        case "P2003":
          return fail(500, "Databasfel (foreign key).", {
            code: err.code,
            meta: err.meta,
          });
        case "P2021":
          return fail(
            500,
            "Saknar databasobjekt (t.ex. tabell). Kontrollera modellen 'verification' och migrering.",
            { code: err.code, meta: err.meta }
          );
        case "P2025":
          return fail(404, "Post saknas (P2025).", {
            code: err.code,
            meta: err.meta,
          });
        default:
          console.error("[auth/register] Prisma error:", err);
          return fail(500, "Databasfel.", { code: err.code, meta: err.meta });
      }
    }
    console.error("[auth/register] error:", err);
    const msg = err instanceof Error ? err.message : "Internt fel.";
    return fail(500, msg);
  }
}
