import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { diagramPresets } from "@/db/schema";
import { eq } from "drizzle-orm";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/diagrams/preset?preset=<id>
 * Returns preset diagram data from DB. Supports nodes+edges (React Flow), drawioData, excalidrawData.
 * Preset must be UUID. Returns 404 if preset not found or has no diagram data (needs first-time AI generation).
 */
export async function GET(req: NextRequest) {
  const preset = req.nextUrl.searchParams.get("preset");
  if (!preset || preset === "none") {
    return NextResponse.json({ error: "Preset required" }, { status: 400 });
  }

  if (!UUID_REGEX.test(preset)) {
    return NextResponse.json({ error: "Invalid preset id" }, { status: 400 });
  }

  const [row] = await db.select().from(diagramPresets).where(eq(diagramPresets.id, preset));
  if (!row) return NextResponse.json({ error: "Preset not found" }, { status: 404 });

  // Draw.io preset
  if (row.drawioData) {
    return NextResponse.json({ drawioData: row.drawioData, targetCanvas: "drawio" });
  }
  // Excalidraw preset
  if (row.excalidrawData && typeof row.excalidrawData === "object") {
    return NextResponse.json({ excalidrawData: row.excalidrawData, targetCanvas: "excalidraw" });
  }
  // React Flow preset (nodes + edges)
  if (Array.isArray(row.nodes) && row.nodes.length > 0) {
    return NextResponse.json({
      nodes: row.nodes,
      edges: row.edges ?? [],
      layoutDirection: "horizontal",
      groups: [],
    });
  }

  return NextResponse.json({ error: "Preset has no diagram data yet; generate with AI first" }, { status: 404 });
}
