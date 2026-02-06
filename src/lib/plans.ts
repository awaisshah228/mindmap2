/**
 * Plan IDs and defaults. Sync with DB seed / Stripe products.
 * Cost basis: ~$0.02–0.05 per diagram (LLM + infra); we price to cover cost + margin.
 */
export const PLAN_IDS = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
} as const;

export const DEFAULT_PLANS = [
  {
    id: PLAN_IDS.FREE,
    name: "Free Trial",
    creditsPerMonth: 0,
    freeTrialCredits: 5,
    priceCentsMonthly: 0,
    priceCentsYearly: 0,
    sortOrder: 0,
  },
  {
    id: PLAN_IDS.STARTER,
    name: "Starter",
    creditsPerMonth: 50,
    freeTrialCredits: 0,
    priceCentsMonthly: 900, // $9
    priceCentsYearly: 9000, // $90
    sortOrder: 1,
  },
  {
    id: PLAN_IDS.PRO,
    name: "Pro",
    creditsPerMonth: 200,
    freeTrialCredits: 0,
    priceCentsMonthly: 2900, // $29
    priceCentsYearly: 29000, // $290
    sortOrder: 2,
  },
] as const;

/** Credits per diagram generation (deducted per request). */
export const CREDITS_PER_GENERATION = 1;

/** On-demand: $5 per 50 credits = 10¢/credit. */
export const ON_DEMAND_CREDITS_BUNDLE = 50;
export const ON_DEMAND_PRICE_CENTS = 500;
