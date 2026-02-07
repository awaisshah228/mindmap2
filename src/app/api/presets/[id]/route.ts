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
    dataFormat: row.dataFormat ?? undefined,
    mermaidData: row.mermaidData ?? undefined,
    targetCanvas: row.targetCanvas ?? "reactflow",
    isTemplate: row.isTemplate,
    sortOrder: row.sortOrder,
    previewImageUrl: row.previewImageUrl ?? undefined,
  });
}

/**
 * PATCH /api/presets/[id]
 * Save generated diagram data to preset (first-time AI generation from AI panel).
 * Body: { nodes?, edges?, drawioData?, excalidrawData?, dataFormat?, mermaidData? }
 *
 * Security: Preset must exist in DB. Frontend cannot create arbitrary presets — only
 * update diagram data for presets that exist (from seed or admin). Validates id exists.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (Array.isArray(body.nodes)) updates.nodes = body.nodes;
  if (Array.isArray(body.edges)) updates.edges = body.edges;
  if (typeof body.drawioData === "string") updates.drawioData = body.drawioData;
  if (body.excalidrawData && typeof body.excalidrawData === "object") updates.excalidrawData = body.excalidrawData;
  if (body.dataFormat === "mermaid" || body.dataFormat === "json") updates.dataFormat = body.dataFormat;
  if (typeof body.mermaidData === "string") updates.mermaidData = body.mermaidData || null;

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: "No diagram data to save" }, { status: 400 });
  }

  // Backend: verify preset exists in DB — cannot create or update non-existent presets
  const [existing] = await db.select({ id: diagramPresets.id }).from(diagramPresets).where(eq(diagramPresets.id, id));
  if (!existing) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  const [row] = await db
    .update(diagramPresets)
    .set(updates as never)
    .where(eq(diagramPresets.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
