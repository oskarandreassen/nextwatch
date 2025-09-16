// app/api/stripe/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      // Ingen Stripe i denna miljö – faila snällt vid RUNTIME (inte vid build)
      return NextResponse.json(
        { ok: false, message: "Stripe is not configured in this environment." },
        { status: 503 }
      );
    }

    const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });

    const body = (await req.json()) as { priceId: string; successUrl: string; cancelUrl: string };
    if (!body?.priceId || !body?.successUrl || !body?.cancelUrl) {
      return NextResponse.json({ ok: false, message: "Invalid payload" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: body.priceId, quantity: 1 }],
      success_url: body.successUrl,
      cancel_url: body.cancelUrl,
    });

    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
