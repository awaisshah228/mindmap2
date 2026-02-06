import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { diagramPresets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPresetDiagram } from "@/lib/diagram-presets-data";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chunk size when streaming the JSON body (so client can parse incrementally). */
const STREAM_CHUNK_SIZE = 256;

/**
 * GET /api/diagrams/preset/stream?preset=<idOrSlug>
 * Returns the same payload as GET /api/diagrams/preset but streams the JSON in small chunks
 * so the client can render nodes/edges in sequence instead of all at once.
 */
export async function GET(req: NextRequest) {
  const preset = req.nextUrl.searchParams.get("preset");
  if (!preset || preset === "none") {
    return NextResponse.json({ error: "Preset required" }, { status: 400 });
  }

  let payload: { nodes: unknown[]; edges: unknown[]; layoutDirection: string; groups: unknown[] };

  if (UUID_REGEX.test(preset)) {
    const [row] = await db.select().from(diagramPresets).where(eq(diagramPresets.id, preset));
    if (!row || !Array.isArray(row.nodes)) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }
    payload = {
      nodes: row.nodes,
      edges: row.edges ?? [],
      layoutDirection: "horizontal",
      groups: [],
    };
  } else {
    const diagram = getPresetDiagram(preset);
    if (!diagram) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }
    payload = {
      nodes: diagram.nodes,
      edges: diagram.edges,
      layoutDirection: "horizontal",
      groups: [],
    };
  }

  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < jsonStr.length; i += STREAM_CHUNK_SIZE) {
        const chunk = jsonStr.slice(i, i + STREAM_CHUNK_SIZE);
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
