import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "../../../../lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });

function newId() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export async function POST(req: Request) {
  try {
    const sig = req.headers.get("stripe-signature");
    if (!sig) return NextResponse.json({ ok:false, error:"missing signature" }, { status:400 });

    const buf = Buffer.from(await req.arrayBuffer());
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const event = stripe.webhooks.constructEvent(buf, sig, secret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = (session.metadata?.userId || session.client_reference_id) as string | undefined;
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

      if (uid) {
        await prisma.user.update({
          where: { id: uid },
          data: { plan: "lifetime", planSince: new Date() }
        });

        await prisma.purchase.create({
          data: {
            id: newId(),
            userId: uid,
            stripePaymentIntentId: pi ?? null,
            amountTotal: session.amount_total ?? 0,
            currency: (session.currency || "sek").toUpperCase(),
            product: "lifetime",
          }
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok:false, error: msg }, { status:400 });
  }
}
