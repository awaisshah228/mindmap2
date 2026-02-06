import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/db";
import { diagramPresets, PRESET_LEVELS } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Preset id required" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.label === "string") updates.label = body.label.trim();
  if (typeof body.description === "string") updates.description = body.description;
  if (typeof body.diagramType === "string") updates.diagramType = body.diagramType;
  if (typeof body.level === "string" && (PRESET_LEVELS as readonly string[]).includes(body.level)) updates.level = body.level;
  if (Array.isArray(body.nodes)) updates.nodes = body.nodes;
  if (Array.isArray(body.edges)) updates.edges = body.edges;
  if (typeof body.prompt === "string") updates.prompt = body.prompt;
  if (typeof body.isTemplate === "boolean") updates.isTemplate = body.isTemplate;
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;
  if (typeof body.previewImageUrl === "string") updates.previewImageUrl = body.previewImageUrl || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(diagramPresets)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(diagramPresets.id, id))
    .returning({ id: diagramPresets.id });

  if (!updated) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
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
    return NextResponse.json({ error: "Preset id required" }, { status: 400 });
  }

  const [deleted] = await db
    .delete(diagramPresets)
    .where(eq(diagramPresets.id, id))
    .returning({ id: diagramPresets.id });

  if (!deleted) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
