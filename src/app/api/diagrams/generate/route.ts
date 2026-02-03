import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(["mindMap", "stickyNote", "rectangle", "diamond", "circle", "document", "text"]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string(),
    shape: z.string().optional(),
  }),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: diagramSchema,
      prompt: `Generate a diagram as JSON. The user wants: "${prompt}"

Return a JSON object with:
- nodes: array of nodes, each with id (string), type (one of: mindMap, stickyNote, rectangle, diamond, circle, document, text), position {x, y}, data {label, shape?}
- edges: array of edges, each with id (string like "e-source-target"), source (node id), target (node id)

For mind maps, use type "mindMap" and create a central node with child nodes connected by edges.
For flowcharts, use rectangle, diamond (decisions), circle (start/end).
Space nodes reasonably (e.g. 150-200px apart).
Use unique ids like "node-1", "node-2", "e-node-1-node-2".`,
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
