import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { ICON_IDS_FOR_PROMPT } from "@/lib/icon-prompt-list";
import { getOpenAiApiKey } from "@/lib/env";
import { getAuthUserId } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { canUseCredits, deductCredits } from "@/lib/credits";

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "mindMap",
    "stickyNote",
    "rectangle",
    "diamond",
    "circle",
    "document",
    "text",
    "databaseSchema",
    "service",
    "queue",
    "actor",
    "icon",
    "image",
  ]),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  data: z.object({
    label: z.string(),
    shape: z.string().optional(),
    icon: z.string().optional(),
    iconUrl: z.string().optional(),
    emoji: z.string().optional(),
    imageUrl: z.string().optional(),
    subtitle: z.string().optional(),
    annotation: z.string().optional(),
    columns: z
      .array(
        z.object({
          name: z.string(),
          type: z.string().optional(),
          key: z.string().optional(),
        })
      )
      .optional(),
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
      /** Edge stroke/border color (hex or rgb) to distinguish connection types. */
      strokeColor: z.string().optional(),
    })
    .optional(),
});

const diagramSchema = z.object({
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const admin = userId ? await isAdmin() : false;
    if (userId && !admin) {
      const can = await canUseCredits(userId);
      if (!can.ok) {
        return NextResponse.json({ error: can.reason ?? "Insufficient credits" }, { status: 402 });
      }
    }

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

    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: diagramSchema,
      prompt: `Generate a COMPLETE diagram JSON for: "${prompt}"

NO POSITIONS, NO HANDLES — auto-layout handles placement.

NODES: id (string), type, data {label, shape?, icon?, iconUrl?, emoji?, imageUrl?, subtitle?, annotation?, columns?}. Do NOT include position.
TYPES: mindMap, stickyNote, rectangle, diamond, circle, document, text, databaseSchema (ER with data.columns), service, queue, actor, icon, image.
Use databaseSchema for ER. Use service/queue/actor for architecture. Use icon/image when appropriate.

EDGES: id, source, target, optional data {label?, strokeColor?}. Do NOT include sourceHandle or targetHandle.

GROUPS (optional): groups: [{ id, label, nodeIds }] for architecture diagrams with 6+ nodes.

COMPLETE: Every component as a node. Every relationship as an edge. No orphan nodes. Minimize edges (max 3–4 per node).

Icon libs: ${ICON_IDS_FOR_PROMPT}. Architecture: data.icon + data.iconUrl. Unique ids.`,
    });

    if (userId && !admin) {
      const deducted = await deductCredits(userId);
      if (!deducted.ok) {
        return NextResponse.json({ error: deducted.reason ?? "Credit deduction failed" }, { status: 402 });
      }
    }

    return NextResponse.json(result.object);
  } catch (err) {
    console.error("AI diagram generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
