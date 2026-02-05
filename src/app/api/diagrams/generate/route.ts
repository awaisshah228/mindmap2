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
      prompt: `Diagram JSON for: "${prompt}"

nodes: id, type (mindMap|stickyNote|rectangle|diamond|circle|document|text), position {x,y}, data {label, shape?, icon?}. Edges: id (e-src-tgt), source, target, sourceHandle?, targetHandle?, data?.label?.
Icon libs: lucide-react, react-icons. data.icon only from: ${ICON_IDS_FOR_PROMPT}. Defaults: lucide:server (services), lucide:database (data).

Mind map: type mindMap, central node at (0,0), children 150–220 apart. Architecture: rectangle for services/DBs, layer left→right or top→bottom, set data.icon. Flowchart: rectangle/diamond/circle, flow one direction.
Spacing 150–220. Unique ids. Edge labels (HTTP, Calls, etc.) for non-mindMap. Only use data.icon from the list or omit.`,
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
