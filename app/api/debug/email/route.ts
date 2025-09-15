// app/api/debug/email/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const to = url.searchParams.get("to");
    if (!to) {
      return NextResponse.json(
        { ok: false, message: "Ange ?to=you@example.com" },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || "NextWatch <noreply@nextwatch.se>";
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, message: "RESEND_API_KEY saknas i miljövariablerna." },
        { status: 500 }
      );
    }

    const html = `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
        <h2>Test från NextWatch</h2>
        <p>Om du ser detta funkar Resend-integrationen.</p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "Test: NextWatch Resend",
        html,
      }),
    });

    const provider = await res.json().catch(() => ({}));
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      provider,
      hint:
        "Kolla Resend > Logs. Om res.ok=false: verifiera domän (SPF/DKIM), eller använd en verifierad 'from', eller lägg in mottagaren som testmottagare.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internt fel.";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
