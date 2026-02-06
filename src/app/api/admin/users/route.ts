import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/db";
import { documents, userCredits } from "@/db/schema";
import { sql, desc } from "drizzle-orm";

export async function GET() {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  const rows = await db
    .select({
      userId: documents.userId,
      docCount: sql<number>`count(${documents.id})::int`,
      balance: userCredits.balance,
    })
    .from(documents)
    .leftJoin(userCredits, sql`${documents.userId} = ${userCredits.userId}`)
    .groupBy(documents.userId, userCredits.balance)
    .orderBy(desc(sql`count(${documents.id})`));

  const users = rows.map((r) => ({
    userId: r.userId,
    docCount: r.docCount,
    balance: r.balance ?? 0,
  }));

  return NextResponse.json({ users });
}
