import { db } from "@/db";
import { userCredits, plans, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PLAN_IDS, CREDITS_PER_GENERATION } from "./plans";

/** Returns true if user can generate (has trial, monthly, or balance). */
export async function canUseCredits(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const [row] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  const planId = sub?.planId ?? PLAN_IDS.FREE;
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  const freeTrialTotal = plan?.freeTrialCredits ?? 5;
  const monthlyTotal = plan?.creditsPerMonth ?? 0;

  const freeTrialLeft = freeTrialTotal - (row?.freeTrialUsed ?? 0);
  const now = new Date();
  let monthlyUsed = row?.monthlyCreditsUsed ?? 0;
  let monthlyResetAt = row?.monthlyResetAt;
  if (monthlyResetAt && now > monthlyResetAt) {
    monthlyUsed = 0;
  }
  const monthlyLeft = Math.max(0, monthlyTotal - monthlyUsed);
  const balance = row?.balance ?? 0;

  const total = freeTrialLeft + monthlyLeft + balance;
  if (total < CREDITS_PER_GENERATION) {
    return { ok: false, reason: "Insufficient credits. Buy more or upgrade plan." };
  }
  return { ok: true };
}

/** Deduct 1 generation: use free trial first, then monthly, then balance. */
export async function deductCredits(userId: string): Promise<{ ok: boolean; reason?: string }> {
  let [row] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
  if (!row) {
    await db.insert(userCredits).values({
      userId,
      balance: 0,
      freeTrialUsed: 0,
      monthlyCreditsUsed: 0,
    }).onConflictDoNothing({ target: userCredits.userId });
    [row] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
  }
  if (!row) return { ok: false, reason: "Could not load credits." };

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  const planId = sub?.planId ?? PLAN_IDS.FREE;
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  const freeTrialTotal = plan?.freeTrialCredits ?? 5;

  const freeTrialUsed = row.freeTrialUsed ?? 0;
  const freeTrialLeft = freeTrialTotal - freeTrialUsed;
  const now = new Date();
  let monthlyCreditsUsed = row?.monthlyCreditsUsed ?? 0;
  let monthlyResetAt = row?.monthlyResetAt;
  if (monthlyResetAt && now > monthlyResetAt) {
    monthlyCreditsUsed = 0;
    monthlyResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  const monthlyTotal = plan?.creditsPerMonth ?? 0;
  const monthlyLeft = Math.max(0, monthlyTotal - monthlyCreditsUsed);
  const balance = row?.balance ?? 0;

  if (freeTrialLeft >= CREDITS_PER_GENERATION) {
    await db
      .update(userCredits)
      .set({
        freeTrialUsed: freeTrialUsed + CREDITS_PER_GENERATION,
        updatedAt: now,
      })
      .where(eq(userCredits.userId, userId));
    return { ok: true };
  }
  if (monthlyLeft >= CREDITS_PER_GENERATION) {
    await db
      .update(userCredits)
      .set({
        monthlyCreditsUsed: monthlyCreditsUsed + CREDITS_PER_GENERATION,
        monthlyResetAt: monthlyResetAt ?? new Date(now.getFullYear(), now.getMonth() + 1, 1),
        updatedAt: now,
      })
      .where(eq(userCredits.userId, userId));
    return { ok: true };
  }
  if (balance >= CREDITS_PER_GENERATION) {
    await db
      .update(userCredits)
      .set({ balance: balance - CREDITS_PER_GENERATION, updatedAt: now })
      .where(eq(userCredits.userId, userId));
    return { ok: true };
  }

  return { ok: false, reason: "Insufficient credits." };
}
