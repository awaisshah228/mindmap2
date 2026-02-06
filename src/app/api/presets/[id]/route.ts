import { NextResponse } from "next/server";
import { db } from "@/db";
import { diagramPresets } from "@/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/presets/[id]
 * Returns full preset including nodes and edges (for loading diagram or preset dropdown value).
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
    isTemplate: row.isTemplate,
    sortOrder: row.sortOrder,
    previewImageUrl: row.previewImageUrl ?? undefined,
  });
}
