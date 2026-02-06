import { NextResponse } from "next/server";
import { db } from "@/db";
import { diagramPresets } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { getPresetsApiFallback } from "@/lib/diagram-presets-data";

/**
 * GET /api/presets?templates=true&level=...
 * List presets for dropdown (isTemplate=false) or templates for sidebar (isTemplate=true).
 * Public; no auth. When DB is unreachable, returns fallback list so app still works.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const templates = searchParams.get("templates") === "true";
  const level = searchParams.get("level") ?? null;

  try {
    const rows = await db
      .select()
      .from(diagramPresets)
      .where(
        level
          ? and(eq(diagramPresets.isTemplate, templates), eq(diagramPresets.level, level))
          : eq(diagramPresets.isTemplate, templates)
      )
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
      hasNodes: Array.isArray(r.nodes) && r.nodes.length > 0,
    }));
    return NextResponse.json(items);
  } catch {
    const fallback = getPresetsApiFallback(templates);
    return NextResponse.json(fallback.map((f) => ({ ...f, description: undefined, previewImageUrl: undefined })));
  }
}
