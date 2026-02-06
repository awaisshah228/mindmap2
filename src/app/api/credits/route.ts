import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { userCredits, plans, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PLAN_IDS } from "@/lib/plans";

/** GET /api/credits – balance, plan, free trial & monthly usage. */
export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const [row] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  const planId = sub?.planId ?? PLAN_IDS.FREE;
  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));

  if (!row) {
    await db.insert(userCredits).values({
      userId,
      balance: 0,
      freeTrialUsed: 0,
      monthlyCreditsUsed: 0,
      monthlyResetAt: null,
    }).onConflictDoNothing({ target: userCredits.userId });
    const [created] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
    const freeTrialTotal = plan?.freeTrialCredits ?? 5;
    return NextResponse.json({
      balance: created?.balance ?? 0,
      planId,
      planName: plan?.name ?? "Free Trial",
      freeTrialCredits: freeTrialTotal,
      freeTrialUsed: created?.freeTrialUsed ?? 0,
      monthlyCredits: plan?.creditsPerMonth ?? 0,
      monthlyCreditsUsed: created?.monthlyCreditsUsed ?? 0,
      monthlyResetAt: created?.monthlyResetAt ?? null,
    });
  }

  const now = new Date();
  let monthlyResetAt = row.monthlyResetAt;
  let monthlyCreditsUsed = row.monthlyCreditsUsed;
  if (monthlyResetAt && now > monthlyResetAt) {
    monthlyResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    monthlyCreditsUsed = 0;
    await db
      .update(userCredits)
      .set({ monthlyCreditsUsed: 0, monthlyResetAt, updatedAt: now })
      .where(eq(userCredits.userId, userId));
  }

  return NextResponse.json({
    balance: row.balance,
    planId,
    planName: plan?.name ?? "Free Trial",
    freeTrialCredits: plan?.freeTrialCredits ?? 0,
    freeTrialUsed: row.freeTrialUsed,
    monthlyCredits: plan?.creditsPerMonth ?? 0,
    monthlyCreditsUsed,
    monthlyResetAt,
  });
}
