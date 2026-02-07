import { NextResponse } from "next/server";
import { db } from "@/db";
import { diagramPresets } from "@/db/schema";
import { eq, asc, and, or, isNull, inArray } from "drizzle-orm";

/** Only the Our website template is enabled for the sidebar (hardcoded data, instant load). */
const ENABLED_TEMPLATE_NAMES = ["template-our-website-ai-diagram-app"] as const;

/**
 * GET /api/presets?templates=true&level=...&targetCanvas=...
 * List presets for dropdown (isTemplate=false) or templates for sidebar (isTemplate=true).
 * For React Flow templates, only 4 major templates are returned (ENABLED_TEMPLATE_NAMES).
 * targetCanvas: reactflow | excalidraw | drawio — filter by canvas type. Omit = all.
 * Public — no auth required. Available to everyone (signed in or not).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templates = searchParams.get("templates") === "true";
  const level = searchParams.get("level") ?? null;
  const targetCanvas = searchParams.get("targetCanvas") ?? null;

  try {
    const baseWhere =
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

    // For React Flow templates, restrict to 4 enabled templates with hardcoded data
    const whereClause =
      templates && (!targetCanvas || targetCanvas === "reactflow")
        ? and(baseWhere, inArray(diagramPresets.name, [...ENABLED_TEMPLATE_NAMES]))
        : baseWhere;

    // Select only lightweight columns for list (no nodes, edges, drawioData, excalidrawData, mermaidData)
    const rows = await db
      .select({
        id: diagramPresets.id,
        name: diagramPresets.name,
        label: diagramPresets.label,
        description: diagramPresets.description,
        diagramType: diagramPresets.diagramType,
        level: diagramPresets.level,
        prompt: diagramPresets.prompt,
        targetCanvas: diagramPresets.targetCanvas,
        isTemplate: diagramPresets.isTemplate,
        sortOrder: diagramPresets.sortOrder,
        previewImageUrl: diagramPresets.previewImageUrl,
      })
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
    }));
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([]);
  }
}
