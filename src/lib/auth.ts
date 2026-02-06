import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/** Returns Clerk user id or null (use in API routes / server components). */
export async function getAuthUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/** Use in API routes: returns user id. Returns NextResponse 401 when not signed in. */
export async function requireAuth(): Promise<string | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return userId;
}
