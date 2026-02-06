import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Comma-separated Clerk user ids from env, e.g. user_2abc,user_2def */
const ADMIN_IDS_ENV = (process.env.ADMIN_CLERK_IDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export async function isAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  if (ADMIN_IDS_ENV.includes(userId)) return true;
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.userId, userId));
  return Boolean(row);
}

export async function requireAdmin(): Promise<string | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (ADMIN_IDS_ENV.includes(userId)) return userId;
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.userId, userId));
  if (!row) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return userId;
}
