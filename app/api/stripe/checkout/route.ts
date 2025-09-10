import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Stripe from "stripe";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const c = await cookies();
    const uid = c.get("nw_uid")?.value;
    if (!uid) return NextResponse.json({ ok:false, error:"no cookie" }, { status:400 });

    // se till att user finns
    await prisma.user.upsert({ where:{ id:uid }, update:{}, create:{ id:uid } });

    const origin = new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: process.env.STRIPE_PRICE_LIFETIME!, quantity: 1 }],
      success_url: `${origin}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/premium?canceled=1`,
      client_reference_id: uid,
      metadata: { userId: uid },
      locale: "sv",
      automatic_tax: { enabled: true } // du valde Stripe Tax: Ja
    });

    return NextResponse.json({ ok:true, url: session.url });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok:false, error: msg }, { status:500 });
  }
}
