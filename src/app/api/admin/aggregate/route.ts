import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/db";
import {
  documents,
  userCredits,
  creditTransactions,
  diagramPresets,
  aiModels,
  cloudIcons,
} from "@/db/schema";
import { sql, count } from "drizzle-orm";

/**
 * GET /api/admin/aggregate
 * Returns aggregate stats for the admin overview tab.
 * Single API call instead of loading all entity data.
 */
export async function GET() {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  const [
    docCount,
    creditsRows,
    txCount,
    presetCount,
    aiModelCount,
    iconCount,
    userCountRow,
    creditsSumRow,
  ] = await Promise.all([
    db.select({ count: count() }).from(documents),
    db.select({ count: count() }).from(userCredits),
    db.select({ count: count() }).from(creditTransactions),
    db.select({ count: count() }).from(diagramPresets),
    db.select({ count: count() }).from(aiModels),
    db.select({ count: count() }).from(cloudIcons),
    db.select({ count: sql<number>`count(distinct ${documents.userId})` }).from(documents),
    db.select({ sum: sql<number>`coalesce(sum(${userCredits.balance}), 0)` }).from(userCredits),
  ]);

  return NextResponse.json({
    totalDocuments: docCount[0]?.count ?? 0,
    totalUsers: Number(userCountRow[0]?.count ?? 0),
    totalCreditsAccounts: creditsRows[0]?.count ?? 0,
    totalCreditTransactions: txCount[0]?.count ?? 0,
    totalPresets: presetCount[0]?.count ?? 0,
    totalAIModels: aiModelCount[0]?.count ?? 0,
    totalCloudIcons: iconCount[0]?.count ?? 0,
    totalCreditsBalance: Number(creditsSumRow[0]?.sum ?? 0),
  });
}
