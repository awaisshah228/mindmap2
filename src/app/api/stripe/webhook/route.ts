import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { db } from "@/db";
import { userCredits, creditTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

/** POST /api/stripe/webhook – Stripe sends checkout.session.completed here. */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  const raw = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId ?? session.client_reference_id;
    const creditsStr = session.metadata?.credits;
    if (!userId || typeof userId !== "string") return NextResponse.json({ received: true });
    const creditsToAdd = creditsStr ? parseInt(creditsStr, 10) || 0 : 0;
    if (creditsToAdd > 0) {
      const [row] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
      if (row) {
        await db
          .update(userCredits)
          .set({ balance: row.balance + creditsToAdd, updatedAt: new Date() })
          .where(eq(userCredits.userId, userId));
      } else {
        await db.insert(userCredits).values({
          userId,
          balance: creditsToAdd,
          freeTrialUsed: 0,
          monthlyCreditsUsed: 0,
        });
      }
      await db.insert(creditTransactions).values({
        userId,
        amount: creditsToAdd,
        type: "purchase",
        description: "Stripe checkout",
        stripePaymentIntentId: session.payment_intent as string | undefined,
      });
    }
  }

  return NextResponse.json({ received: true });
}
