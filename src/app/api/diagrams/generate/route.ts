import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ICON_IDS_FOR_PROMPT } from "@/lib/icon-prompt-list";
import { getOpenAiApiKey } from "@/lib/env";

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(["mindMap", "stickyNote", "rectangle", "diamond", "circle", "document", "text"]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string(),
    shape: z.string().optional(),
    /**
     * Optional icon identifier for tech/architecture diagrams.
     * Should be one of the IDs from ICON_REGISTRY, e.g.:
     * "lucide:server", "lucide:database", "si:aws", "si:googlecloud",
     * "si:docker", "si:kubernetes", "si:postgresql", "si:redis",
     * "si:openai", "si:langchain".
     */
    icon: z.string().optional(),
  }),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  data: z
    .object({
      label: z.string().optional(),
      connectionLength: z.number().optional(),
    })
    .optional(),
});

const diagramSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
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

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: diagramSchema,
      prompt: `Generate a diagram JSON for: "${prompt}"

NODES: Each node must have: id (string), type (mindMap|stickyNote|rectangle|diamond|circle|document|text), position {x: number, y: number} as EXACT canvas coordinates, data {label, shape?, icon?}.

POSITIONING RULES — THIS IS CRITICAL:
- Place the first/central node at position {x: 0, y: 0}.
- Space nodes generously: minimum 300px apart on the X axis and 250px apart on the Y axis.
- For horizontal flows: increment x by 350–450 for each column, y by 280–350 for each row.
- For vertical flows: increment y by 300–400 for each row, x by 350–450 for each column.
- For mind maps: central node at (0,0), first-level children at x ±400, y offset ±300 from center.
- NEVER stack nodes at the same position. Each node MUST have a unique {x, y}.

EDGES: id (e-src-tgt), source, target, sourceHandle ("left"|"right"|"top"|"bottom"), targetHandle ("left"|"right"|"top"|"bottom"), data.label? (e.g. "HTTP", "Calls", "Queries"), data.connectionLength? (number, the pixel distance between source and target, typically 300–500).

Icon libs: lucide-react, react-icons. data.icon only from: ${ICON_IDS_FOR_PROMPT}. Defaults: lucide:server (services), lucide:database (data).

Architecture: rectangle for services/DBs, layer left→right or top→bottom, set data.icon. Flowchart: rectangle/diamond/circle, flow one direction.
Unique ids. Edge labels for non-mindMap. Only use data.icon from the list or omit.`,
    });

    return NextResponse.json(object);
  } catch (err) {
    console.error("AI diagram generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
