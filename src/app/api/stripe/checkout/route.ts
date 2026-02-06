import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import Stripe from "stripe";
import { ON_DEMAND_CREDITS_BUNDLE, ON_DEMAND_PRICE_CENTS } from "@/lib/plans";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key);
}

/** POST /api/stripe/checkout – create Stripe Checkout for on-demand credits (or plan). */
export async function POST(request: Request) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;
  const stripe = getStripe();

  let body: { type?: "credits"; amount?: number; successUrl?: string; cancelUrl?: string } = {};
  try {
    body = await request.json();
  } catch {
    // optional body
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const successUrl = body.successUrl ?? `${baseUrl}/editor?credits=success`;
  const cancelUrl = body.cancelUrl ?? `${baseUrl}/editor`;

  // On-demand credits: default 50 credits for $5
  const credits = Math.max(10, Math.min(500, body.amount ?? ON_DEMAND_CREDITS_BUNDLE));
  const amountCents = Math.round((credits / ON_DEMAND_CREDITS_BUNDLE) * ON_DEMAND_PRICE_CENTS) || ON_DEMAND_PRICE_CENTS;

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "AI Diagram Credits",
            description: `${credits} credits for diagram generation`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    metadata: { userId, credits: String(credits), type: "credits" },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
