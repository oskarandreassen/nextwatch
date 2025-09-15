// app/api/auth/request-verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "../../../../lib/prisma";
import { randomBytes } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function computeOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

async function sendVerifyEmail(to: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "NextWatch <noreply@nextwatch.se>";
  if (!apiKey) return { sent: false as const, reason: "missing_resend_api_key" as const };

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Bekräfta din e-post</h2>
      <p>Klicka på länken nedan för att verifiera din e-postadress:</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Verifiera e-post</a></p>
      <p>Giltig i 24 timmar.</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: "Bekräfta din e-post", html }),
  });
  const json = (await res.json().catch(() => ({}))) as unknown;
  return { sent: res.ok, provider: json };
}

export async function GET(req: NextRequest) {
  // Använd absolut URL i redirect för att undvika varningar
  return NextResponse.redirect(new URL("/auth/verify/sent", req.url));
}

export async function POST(req: NextRequest) {
  try {
    // IMPORTANT: await cookies()
    const jar = await cookies();
    const uid = jar.get("nw_uid")?.value ?? null;
    if (!uid) {
      return NextResponse.json({ ok: false, message: "Ingen session." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, email: true },
    });
    if (!user?.email) {
      return NextResponse.json({ ok: false, message: "Ingen e-post registrerad." }, { status: 400 });
    }

    await prisma.verification.deleteMany({ where: { userId: uid } });

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.verification.create({
      data: { token, userId: uid, email: user.email, name: null, expiresAt },
    });

    const origin = computeOrigin(req);
    const link = `${origin}/auth/verify?token=${token}`;
    const mailRes = await sendVerifyEmail(user.email, link);

    return NextResponse.json({
      ok: true,
      message: mailRes.sent ? "Verifieringslänk skickad." : "Länk skapad men e-post kunde inte skickas.",
      verifyUrl: link,
      emailSent: mailRes.sent,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internt fel.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
