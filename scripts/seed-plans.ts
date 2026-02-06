/**
 * Seed default plans.
 * @see https://orm.drizzle.team/docs/get-started/neon-new
 * Run: yarn seed:plans   or   yarn db:seed:plans   or   npx tsx scripts/seed-plans.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

const plans = [
  { id: "free", name: "Free Trial", credits_per_month: 0, free_trial_credits: 5, price_cents_monthly: null, price_cents_yearly: null, sort_order: 0 },
  { id: "starter", name: "Starter", credits_per_month: 50, free_trial_credits: 0, price_cents_monthly: 500, price_cents_yearly: 5000, sort_order: 1 },
  { id: "pro", name: "Pro", credits_per_month: 200, free_trial_credits: 0, price_cents_monthly: 2900, price_cents_yearly: 29000, sort_order: 2 },
];

async function main() {
  for (const p of plans) {
    await sql`
      INSERT INTO plans (id, name, credits_per_month, free_trial_credits, price_cents_monthly, price_cents_yearly, sort_order)
      VALUES (${p.id}, ${p.name}, ${p.credits_per_month}, ${p.free_trial_credits}, ${p.price_cents_monthly}, ${p.price_cents_yearly}, ${p.sort_order})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        credits_per_month = EXCLUDED.credits_per_month,
        free_trial_credits = EXCLUDED.free_trial_credits,
        price_cents_monthly = EXCLUDED.price_cents_monthly,
        price_cents_yearly = EXCLUDED.price_cents_yearly,
        sort_order = EXCLUDED.sort_order
    `;
  }
  console.log("Plans seeded.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
