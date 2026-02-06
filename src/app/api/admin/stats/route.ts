import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/db";
import { documents, userCredits, creditTransactions, diagramPresets } from "@/db/schema";
import { sql, count } from "drizzle-orm";

export async function GET() {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  const [docCount] = await db.select({ count: count() }).from(documents);
  const [creditsRows] = await db.select({ count: count() }).from(userCredits);
  const [txCount] = await db.select({ count: count() }).from(creditTransactions);
  const [presetCount] = await db.select({ count: count() }).from(diagramPresets);

  const [userCountRow] = await db
    .select({ count: sql<number>`count(distinct ${documents.userId})` })
    .from(documents);

  return NextResponse.json({
    totalDocuments: docCount?.count ?? 0,
    totalUsers: Number(userCountRow?.count ?? 0),
    totalCreditsAccounts: creditsRows?.count ?? 0,
    totalCreditTransactions: txCount?.count ?? 0,
    totalPresets: presetCount?.count ?? 0,
  });
}
