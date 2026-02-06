import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/db";
import { aiModels } from "@/db/schema";
import { eq } from "drizzle-orm";

const PROVIDERS = ["openai", "openrouter", "anthropic", "google", "custom"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Model id required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.provider === "string" && PROVIDERS.includes(body.provider as (typeof PROVIDERS)[number])) {
    updates.provider = body.provider;
  }
  if (typeof body.model === "string") updates.model = body.model.trim();
  if (typeof body.label === "string") updates.label = body.label.trim();
  if (typeof body.baseUrl === "string") updates.baseUrl = body.baseUrl.trim() || null;
  if (typeof body.isDefault === "boolean") updates.isDefault = body.isDefault;
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (body.isDefault === true) {
    await db.update(aiModels).set({ isDefault: false, updatedAt: new Date() });
  }

  const [updated] = await db
    .update(aiModels)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(aiModels.id, id))
    .returning({ id: aiModels.id });

  if (!updated) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }
  return NextResponse.json({ id: updated.id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Model id required" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(aiModels)
    .where(eq(aiModels.id, id))
    .returning({ id: aiModels.id });

  if (!deleted) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
