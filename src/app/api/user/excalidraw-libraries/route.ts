/**
 * GET /api/user/excalidraw-libraries – fetch user's cloud-synced Excalidraw library items.
 * PUT /api/user/excalidraw-libraries – save library items to cloud (when signed in).
 * Body: { libraryItems: unknown[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { userExcalidrawLibraries } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const [row] = await db
    .select()
    .from(userExcalidrawLibraries)
    .where(eq(userExcalidrawLibraries.userId, userId));

  const items = Array.isArray(row?.libraryItems) ? row.libraryItems : [];
  return NextResponse.json({ libraryItems: items });
}

export async function PUT(req: NextRequest) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  let body: { libraryItems?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const libraryItems = Array.isArray(body.libraryItems) ? body.libraryItems : [];

  await db
    .insert(userExcalidrawLibraries)
    .values({ userId, libraryItems, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userExcalidrawLibraries.userId,
      set: { libraryItems, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
