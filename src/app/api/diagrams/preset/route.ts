import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { diagramPresets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPresetDiagram } from "@/lib/diagram-presets-data";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/diagrams/preset?preset=<idOrSlug>
 * Returns nodes + edges for the preset. Preset can be UUID (from DB) or slug (legacy hardcoded).
 * No auth or credits.
 */
export async function GET(req: NextRequest) {
  const preset = req.nextUrl.searchParams.get("preset");
  if (!preset || preset === "none") {
    return NextResponse.json({ error: "Preset required" }, { status: 400 });
  }

  if (UUID_REGEX.test(preset)) {
    const [row] = await db.select().from(diagramPresets).where(eq(diagramPresets.id, preset));
    if (row && Array.isArray(row.nodes) && row.nodes.length > 0) {
      return NextResponse.json({
        nodes: row.nodes,
        edges: row.edges ?? [],
        layoutDirection: "horizontal",
        groups: [],
      });
    }
  }

  const diagram = getPresetDiagram(preset);
  if (!diagram) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }
  return NextResponse.json({
    nodes: diagram.nodes,
    edges: diagram.edges,
    layoutDirection: "horizontal",
    groups: [],
  });
}
