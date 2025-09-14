// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return NextResponse.json(
        { ok: false, message: "Ingen session. Logga in igen." },
        { status: 401 }
      );
    }

    const body = (await req.json()) as {
      email?: string;
      password?: string;
    };

    const email = (body.email || "").trim().toLowerCase();
    const password = (body.password || "").trim();

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, message: "E-post och lösenord krävs." },
        { status: 400 }
      );
    }

    // Finns användaren?
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true },
    });
    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Ogiltig session. Användare saknas." },
        { status: 401 }
      );
    }

    // Är e-post upptagen av annan user?
    const taken = await prisma.user.findFirst({
      where: { email, NOT: { id: uid } },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json(
        { ok: false, message: "E-postadressen används redan." },
        { status: 409 }
      );
    }

    // Hasha lösenord
    const hash = await bcrypt.hash(password, 12);

    // Uppdatera user
    await prisma.user.update({
      where: { id: uid },
      data: {
        email,
        passwordHash: hash,
        // email_verified lämnas null tills verifikation
      },
    });

    // Skapa verifikationstoken (giltig i 24h)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.verification.create({      data: {
        token,
        user_id: uid,
        email,
        name: null,
        expires_at: expiresAt,
      },
    });

    // Här kan du skicka e-post med token-länk:
    // ex: https://nextwatch.app/auth/verify?token=XYZ
    // (Implementera din mail-provider senare)
    return NextResponse.json({
      ok: true,
      message: "Konto uppdaterat. Verifieringslänk skapad.",
      // dev-hjälp: skicka tillbaka token tills e-post är på plats
      devToken: token,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        { ok: false, message: "Databasfel.", code: err.code, meta: err.meta },
        { status: 500 }
      );
    }
    const msg = err instanceof Error ? err.message : "Internt fel.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
