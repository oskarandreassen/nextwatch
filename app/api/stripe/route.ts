// app/api/stripe/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import Stripe from 'stripe';
import { NextResponse } from 'next/server';

type CreateCheckoutPayload = {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
};

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: '2025-08-27.basil' });
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: false, message: 'Stripe is not configured (missing STRIPE_SECRET_KEY).' },
        { status: 503 }
      );
    }

    const body = (await req.json()) as Partial<CreateCheckoutPayload>;
    const { priceId, successUrl, cancelUrl } = body;

    // Minimal inputvalidering
    if (!priceId || !successUrl || !cancelUrl) {
      return NextResponse.json(
        { ok: false, message: 'Missing required fields: priceId, successUrl, cancelUrl.' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // valfritt: customer_email etc.
    });

    return NextResponse.json({ ok: true, url: session.url }, { status: 200 });
  } catch (e) {
    // Logga men undvik att läcka detaljer
    console.error('[stripe POST] error', e);
    return NextResponse.json(
      { ok: false, message: 'Stripe error. Try again later.' },
      { status: 500 }
    );
  }
}

// (valfritt) En GET som inte initierar Stripe vid saknad nyckel
export async function GET() {
  const configured = Boolean(process.env.STRIPE_SECRET_KEY);
  return NextResponse.json({ ok: true, configured }, { status: 200 });
}
