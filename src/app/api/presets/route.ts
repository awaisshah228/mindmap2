import { NextResponse } from "next/server";
import { db } from "@/db";
import { diagramPresets } from "@/db/schema";
import { eq, asc, and, or, isNull } from "drizzle-orm";

/**
 * GET /api/presets?templates=true&level=...&targetCanvas=...
 * List presets for dropdown (isTemplate=false) or templates for sidebar (isTemplate=true).
 * targetCanvas: reactflow | excalidraw | drawio — filter by canvas type. Omit = all.
 * Public — no auth required. Available to everyone (signed in or not).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templates = searchParams.get("templates") === "true";
  const level = searchParams.get("level") ?? null;
  const targetCanvas = searchParams.get("targetCanvas") ?? null;

  try {
    const whereClause =
      targetCanvas === "reactflow"
        ? and(
            eq(diagramPresets.isTemplate, templates),
            ...(level ? [eq(diagramPresets.level, level)] : []),
            or(eq(diagramPresets.targetCanvas, "reactflow"), isNull(diagramPresets.targetCanvas))
          )
        : targetCanvas === "drawio" || targetCanvas === "excalidraw"
          ? and(
              eq(diagramPresets.isTemplate, templates),
              ...(level ? [eq(diagramPresets.level, level)] : []),
              eq(diagramPresets.targetCanvas, targetCanvas)
            )
          : and(
              eq(diagramPresets.isTemplate, templates),
              ...(level ? [eq(diagramPresets.level, level)] : [])
            );

    const rows = await db
      .select()
      .from(diagramPresets)
      .where(whereClause)
      .orderBy(asc(diagramPresets.sortOrder), asc(diagramPresets.name));

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      description: r.description ?? undefined,
      diagramType: r.diagramType,
      level: r.level,
      prompt: r.prompt ?? undefined,
      isTemplate: r.isTemplate,
      sortOrder: r.sortOrder,
      previewImageUrl: r.previewImageUrl ?? undefined,
      targetCanvas: r.targetCanvas ?? "reactflow",
      hasNodes: Array.isArray(r.nodes) && r.nodes.length > 0,
      hasDrawioData: Boolean(r.drawioData),
      hasExcalidrawData: Boolean(r.excalidrawData),
    }));
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}
