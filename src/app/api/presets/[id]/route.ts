import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { diagramPresets } from "@/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/presets/[id]
 * Returns full preset including nodes, edges, drawioData, excalidrawData.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const [row] = await db.select().from(diagramPresets).where(eq(diagramPresets.id, id));
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: row.id,
    name: row.name,
    label: row.label,
    description: row.description ?? undefined,
    diagramType: row.diagramType,
    level: row.level,
    nodes: row.nodes ?? [],
    edges: row.edges ?? [],
    prompt: row.prompt ?? undefined,
    drawioData: row.drawioData ?? undefined,
    excalidrawData: row.excalidrawData ?? undefined,
    targetCanvas: row.targetCanvas ?? "reactflow",
    isTemplate: row.isTemplate,
    sortOrder: row.sortOrder,
    previewImageUrl: row.previewImageUrl ?? undefined,
  });
}

/**
 * PATCH /api/presets/[id]
 * Save generated diagram data to preset (first-time AI generation).
 * Body: { nodes?, edges?, drawioData?, excalidrawData? }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (Array.isArray(body.nodes)) updates.nodes = body.nodes;
  if (Array.isArray(body.edges)) updates.edges = body.edges;
  if (typeof body.drawioData === "string") updates.drawioData = body.drawioData;
  if (body.excalidrawData && typeof body.excalidrawData === "object") updates.excalidrawData = body.excalidrawData;

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No diagram data to save" }, { status: 400 });
  }

  const [row] = await db
    .update(diagramPresets)
    .set(updates as never)
    .where(eq(diagramPresets.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
