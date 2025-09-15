// app/api/debug/email/route.ts
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asBool(v?: string | null, def = false) {
  if (!v) return def;
  return ["true", "1", "yes", "on"].includes(String(v).toLowerCase());
}
function asNum(v?: string | null, def = 587) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const to = url.searchParams.get("to");
    if (!to) return NextResponse.json({ ok: false, message: "Ange ?to=you@example.com" }, { status: 400 });

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = asNum(process.env.SMTP_PORT, 587);
    const secure = asBool(process.env.SMTP_SECURE, port === 465);
    const from = process.env.SMTP_FROM || `NextWatch <${user ?? "noreply@localhost"}>`;

    if (!host || !user || !pass) {
      return NextResponse.json({ ok: false, message: "SMTP_* env saknas", detail: { host, user, pass } }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    const info = await transporter.sendMail({
      from,
      to,
      subject: "Test: NextWatch SMTP",
      html: "<p>Detta är ett SMTP-test från NextWatch.</p>",
    });

    return NextResponse.json({ ok: true, provider: { messageId: info.messageId, response: info.response } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internt fel.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
