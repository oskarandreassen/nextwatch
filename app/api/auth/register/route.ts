// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonRes(
  status: number,
  message: string,
  extra?: Record<string, unknown>
) {
  const body: Record<string, unknown> = {
    ok: status >= 200 && status < 300,
    message,
  };
  if (extra) body.extra = extra;
  return NextResponse.json(body, { status });
}

function computeOrigin(req: NextRequest): string {
  // Företräde: NEXT_PUBLIC_APP_URL om satt
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

async function sendVerifyEmail(to: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "NextWatch <noreply@nextwatch.se>";
  if (!apiKey) {
    return { sent: false as const, reason: "missing_resend_api_key" as const };
  }
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Bekräfta din e-post</h2>
      <p>Klicka på länken nedan för att verifiera din e-postadress:</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Verifiera e-post</a></p>
      <p>Giltig i 24 timmar. Om knappen inte fungerar, kopiera länken:</p>
      <p><code>${link}</code></p>
    </div>
  `;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject: "Bekräfta din e-post", html }),
  });
  const json = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) return { sent: false as const, reason: "provider_error", provider: json };
  return { sent: true as const, provider: json };
}

export async function POST(req: NextRequest) {
  try {
    // IMPORTANT: await cookies()
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) return jsonRes(401, "Ingen session. Logga in igen.");

    const body = (await req.json()) as { email?: string; password?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = (body.password ?? "").trim();
    if (!email || !password) return jsonRes(400, "E-post och lösenord krävs.");

    // Preflight: kontroll av kolumner i aktiva DB
    const [usersCols, verCols] = await Promise.all([
      prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
      `,
      prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'verifications'
      `,
    ]);
    const u = new Set(usersCols.map((r) => r.column_name));
    const v = new Set(verCols.map((r) => r.column_name));
    const missingUsers = ["password_hash", "email_verified", "last_login_at"].filter((c) => !u.has(c));
    const missingVer = ["token", "user_id", "email", "name", "created_at", "expires_at"].filter((c) => !v.has(c));
    if (missingUsers.length || missingVer.length) {
      return jsonRes(500, "DB-schema mismatch (saknade kolumner).", {
        missingUsers,
        missingVerifications: missingVer,
      });
    }

    const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
    if (!user) return jsonRes(401, "Ogiltig session. Användare saknas.", { uid });

    const taken = await prisma.user.findFirst({ where: { email, NOT: { id: uid } }, select: { id: true } });
    if (taken) return jsonRes(409, "E-postadressen används redan.");

    const hash = await bcrypt.hash(password, 12);
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: uid },
        data: { email, passwordHash: hash }, // @map("password_hash")
      }),
      prisma.verification.create({
        data: { token, userId: uid, email, name: null, expiresAt },
      }),
    ]);

    const origin = computeOrigin(req);
    const link = `${origin}/auth/verify?token=${token}`;
    const mailRes = await sendVerifyEmail(email, link);

    return NextResponse.json({
      ok: true,
      message: mailRes.sent
        ? "Konto uppdaterat. Verifieringslänk skickad."
        : "Konto uppdaterat. Kunde inte skicka e-post – kopiera länken nedan.",
      verifyUrl: link,
      emailSent: mailRes.sent,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return jsonRes(500, `Databasfel (${err.code}).`, { code: err.code, meta: err.meta });
    }
    console.error("[auth/register] error:", err);
    const msg = err instanceof Error ? err.message : "Internt fel.";
    return jsonRes(500, msg);
  }
}
