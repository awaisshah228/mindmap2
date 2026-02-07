/**
 * POST /api/diagrams/preset/generate?preset=<id>
 *
 * For presets/templates with no diagram data: generate via AI using the preset's prompt,
 * save to DB, and return the diagram. Works without auth. Backend validates preset exists
 * in DB (cannot fake or create arbitrary presets).
 *
 * Security: Only generates for presets that exist in diagram_presets. Frontend cannot
 * create custom prompts as template/preset — all presets come from seed or admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { db } from "@/db";
import { diagramPresets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOpenAiApiKey } from "@/lib/env";
import { ICON_IDS_FOR_PROMPT } from "@/lib/icon-prompt-list";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "mindMap", "stickyNote", "rectangle", "diamond", "circle", "document",
    "text", "databaseSchema", "service", "queue", "actor", "icon", "image",
  ]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string(),
    shape: z.string().optional(),
    icon: z.string().optional(),
    iconUrl: z.string().optional(),
    emoji: z.string().optional(),
    imageUrl: z.string().optional(),
    subtitle: z.string().optional(),
    annotation: z.string().optional(),
    columns: z.array(z.object({
      name: z.string(),
      type: z.string().optional(),
      key: z.string().optional(),
    })).optional(),
  }),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  data: z.object({
    label: z.string().optional(),
    connectionLength: z.number().optional(),
    strokeColor: z.string().optional(),
  }).optional(),
});

const diagramSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export async function POST(req: NextRequest) {
  const preset = req.nextUrl.searchParams.get("preset");
  if (!preset || preset === "none") {
    return NextResponse.json({ error: "Preset required" }, { status: 400 });
  }

  if (!UUID_REGEX.test(preset)) {
    return NextResponse.json({ error: "Invalid preset id" }, { status: 400 });
  }

  // Backend: verify preset exists in DB — cannot fake or create arbitrary presets
  const [row] = await db.select().from(diagramPresets).where(eq(diagramPresets.id, preset));
  if (!row) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  // If preset already has diagram data, return it (no generation needed)
  const targetCanvas = row.targetCanvas ?? "reactflow";
  if (targetCanvas === "drawio" && row.drawioData) {
    return NextResponse.json({ drawioData: row.drawioData, targetCanvas: "drawio" });
  }
  if (targetCanvas === "excalidraw" && row.excalidrawData) {
    return NextResponse.json({
      excalidrawData: row.excalidrawData,
      targetCanvas: "excalidraw",
    });
  }
  if ((targetCanvas === "reactflow" || !targetCanvas) && Array.isArray(row.nodes) && row.nodes.length > 0) {
    return NextResponse.json({
      nodes: row.nodes,
      edges: row.edges ?? [],
      layoutDirection: "horizontal",
      groups: [],
    });
  }

  // Only React Flow presets supported for on-demand generate (Draw.io/Excalidraw need their own APIs)
  const canvas = row.targetCanvas ?? "reactflow";
  if (canvas !== "reactflow") {
    return NextResponse.json(
      { error: "Generate on-demand only supported for React Flow presets" },
      { status: 400 }
    );
  }

  // React Flow preset with no data: generate using preset's prompt
  const prompt = row.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "Preset has no prompt and no diagram data" },
      { status: 400 }
    );
  }

  const openAiApiKey = getOpenAiApiKey();
  if (!openAiApiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  try {
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: diagramSchema,
      prompt: `Generate a COMPLETE diagram JSON for: "${prompt}"

NODES: Each node must have: id (string), type, position {x, y}, data {label, shape?, icon?, iconUrl?, emoji?, imageUrl?, subtitle?, annotation?, columns?}.
TYPES: mindMap, stickyNote, rectangle, diamond, circle, document, text, databaseSchema (with data.columns), service, queue, actor, icon, image.
Do NOT default everything to rectangle. Use databaseSchema for ER with data.columns. Use service/queue/actor for architecture.

POSITIONING: Architecture: tiered rows. ER: same row = same y. Space 150-250px between nodes. Never overlap.

EDGES: id, source, target, sourceHandle, targetHandle. Horizontal: sourceHandle "right", targetHandle "left". data.label for protocols.

COMPLETE: Every component, every relationship. No orphan nodes. Icon libs: ${ICON_IDS_FOR_PROMPT}. Unique ids.`,
    });

    const { nodes, edges } = result.object;

    // Save to DB so we don't need to generate again
    await db
      .update(diagramPresets)
      .set({
        nodes,
        edges,
        updatedAt: new Date(),
      })
      .where(eq(diagramPresets.id, preset));

    return NextResponse.json({
      nodes,
      edges,
      layoutDirection: "horizontal",
      groups: [],
    });
  } catch (err) {
    console.error("[preset/generate] AI generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
