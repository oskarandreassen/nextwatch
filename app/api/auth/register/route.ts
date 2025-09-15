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

    // Finns user?
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true },
    });
    if (!user) {
      return fail(401, "Ogiltig session. Användare saknas.", { uid });
    }

    // Är e-post upptagen av någon annan?
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: uid } },
      select: { id: true },
    });
    if (taken) {
      return fail(409, "E-postadressen används redan.");
    }

    const hash = await bcrypt.hash(password, 12);

    // Skapa verify-token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Transaktion: uppdatera user + skapa verification
    await prisma.$transaction([
      prisma.user.update({
        where: { id: uid },
        data: {
          email,
          passwordHash: hash, // Prisma-fält (DB: password_hash)
          // emailVerified: null // låt den vara null tills verifierad
        },
      }),
      prisma.verification.create({
        data: {
          token,
          userId: uid,  // Prisma-fält (DB: user_id)
          email,
          name: null,
          expiresAt,    // Prisma-fält (DB: expires_at)
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Konto uppdaterat. Verifieringslänk skapad.",
      // devToken: token, // avkommentera vid behov under utveckling
    });
  } catch (err) {
    // Prisma fel – ge tydligt svar
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // https://www.prisma.io/docs/orm/reference/error-reference
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
            "Databasobjekt saknas (t.ex. tabell eller vy). Kontrollera att modellen 'verification' är migrerad till din DB.",
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
