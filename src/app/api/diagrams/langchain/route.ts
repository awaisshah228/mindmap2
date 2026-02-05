import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { ICON_IDS_FOR_PROMPT } from "@/lib/icon-prompt-list";
import {
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenRouterHttpReferer,
  getOpenRouterAppTitle,
} from "@/lib/env";

export const runtime = "nodejs";

// We talk to OpenRouter instead of api.openai.com.
// Model names are OpenRouter-compatible, e.g. "openai/gpt-4o-mini".
type SupportedModel =
  | "openai/gpt-4.1-mini"
  | "openai/gpt-4.1"
  | "openai/gpt-4o-mini"
  | "openai/gpt-4o"
  | "openai/o3-mini";

function getModel(model?: string): SupportedModel {
  const fallback: SupportedModel = "openai/gpt-4o-mini";
  if (!model) return fallback;
  const allowed: SupportedModel[] = [
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1",
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "openai/o3-mini",
  ];
  return (allowed as string[]).includes(model) ? (model as SupportedModel) : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      model,
      previousPrompt,
      previousDiagram,
      layoutDirection,
      mode,
      focusNodeId,
      diagramType,
    } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const openRouterApiKey = getOpenRouterApiKey();
    if (!openRouterApiKey) {
      return NextResponse.json(
        { error: "OPENROUTER_API_KEY not configured" },
        { status: 500 }
      );
    }

    const llm = new ChatOpenAI({
      model: getModel(model),
      temperature: 0.2,
      apiKey: openRouterApiKey,
      streaming: true,
      configuration: {
        baseURL: getOpenRouterBaseUrl(),
        defaultHeaders: {
          "HTTP-Referer": getOpenRouterHttpReferer(),
          "X-Title": getOpenRouterAppTitle(),
        },
      },
    });

    const preferredLayoutDirection =
      layoutDirection === "vertical" ? "vertical" : "horizontal";

    const systemPrompt = `
You design diagrams for a React Flow whiteboard. Return only valid JSON matching the schema below. No markdown, no comments.

Node types: mindMap, stickyNote, rectangle, diamond, circle, document, text, image, databaseSchema, service, queue, actor, group.
Layout: preferred layoutDirection is ${preferredLayoutDirection}. Use positions in [-1000,1000], spacing 150–220. Align in rows/columns. Edges: source/target = node ids; use sourceHandle/targetHandle "left"|"right"|"top"|"bottom" to match flow.

Schema: nodes have id, type, position {x,y}. For groups: type "group", style {width, height}. For nodes inside a group: "parentNode": "<group-id>", position relative to group (e.g. 10, 20). data: label, shape?, icon?, imageUrl?, subtitle?, columns? (for databaseSchema). edges: id, source, target, sourceHandle?, targetHandle?, data?.label?.

Icons: We use lucide-react and react-icons (si, fa). Set data.icon only to one of: ${ICON_IDS_FOR_PROMPT}. Defaults: services "lucide:server", data stores "lucide:database". Never use an icon not in this list.

Mind map (only when user asks for mind map): type "mindMap", central node near (0,0), children 150–220 apart. If mode=mindmap-refine and focusNodeId set: add only children of that node; source=focusNodeId for every new edge.

Architecture: rectangle for services/queues/gateways, document/text for notes, circle for start/end. Clear path (e.g. User→Frontend→API→Services→DB). Set data.icon on every rectangle/circle/document so no plain text-only nodes.

Subflows (parent-child grouping): Use type "group" for logical clusters that contain multiple nodes. Keep single concepts as top-level nodes (e.g. User, Frontend = one node each). Use groups for: "Backend", "AWS", "GCP", "API layer", "Services" — any container that has several nodes inside. Group node: type "group", id, data.label (e.g. "Backend", "AWS"), position {x,y}, style {width, height} (e.g. 280–400 width, 200–300 height). Child nodes inside the group: set "parentNode" to the group's id; position {x,y} is relative to the group (e.g. 10–50, 20–80). You can nest groups: inner group has parentNode = outer group id, its children have parentNode = inner group id. Edges can connect across: e.g. source "frontend" (top-level) target "api-gw" (node inside group "backend"). Define the group node before any node that references it as parentNode.

Flowchart: rectangle=step, diamond=decision, circle=start/end. Flow top→bottom or left→right.

Special types: databaseSchema → data.columns [{name, type?, key?}]. service → data.subtitle optional. queue/actor → data.label.

Images: type "image" with data.imageUrl = https://picsum.photos/seed/<word>/200/150 (seed: user, api, database, server, etc.). data.label = short caption.

Rules: Short labels (2–5 words). Unique ids. Edges reference node ids. Non-mindMap: add edge.data.label where helpful (e.g. "HTTP", "Calls"). Always add data.icon or imageUrl for most nodes; never all plain rectangles.
`.trim();

    const isMindmapRefine = mode === "mindmap-refine" && focusNodeId;

    const diagramTypeHint =
      diagramType && diagramType !== "auto"
        ? (() => {
            const hints: Record<string, string> = {
              mindmap: "Type: mind map. Central topic + branches, all nodes mindMap.",
              architecture: "Type: architecture. Services, APIs, gateways, data stores; use data.icon or image nodes.",
              flowchart: "Type: flowchart. Rectangles (steps), diamonds (decisions), circles (start/end).",
              sequence: "Type: sequence. Actors and interactions, clear lanes.",
              "entity-relationship": "Type: ER. Entities and relationships.",
              bpmn: "Type: BPMN. Tasks, gateways, flows.",
            };
            return hints[diagramType] ?? "";
          })()
        : "";

    const typeBlock = diagramTypeHint ? `${diagramTypeHint}\n\n` : "";
    const meta = `Mode: ${isMindmapRefine ? "mindmap-refine" : "diagram"}. focusNodeId: ${focusNodeId ?? "—"}. layout: ${preferredLayoutDirection}.`;

    const userMessage =
      previousDiagram && Object.keys(previousDiagram).length > 0
        ? `${typeBlock}${prompt}\n\n${meta}\n\nPrevious prompt: ${previousPrompt ?? "—"}\n\nPrevious diagram:\n${JSON.stringify(previousDiagram)}\n\nReturn full diagram JSON only.${isMindmapRefine ? " Extend only the focused node's branch." : ""}`
        : `${typeBlock}${prompt}\n\n${meta}\n\nReturn diagram JSON only.`;

    const stream = await llm.stream([
      ["system", systemPrompt],
      ["user", userMessage],
    ]);

    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Each chunk is an AIMessageChunk; get its content as string.
            const text =
              typeof chunk.content === "string"
                ? chunk.content
                : Array.isArray(chunk.content)
                  ? chunk.content
                      .map((c: any) => (typeof c === "string" ? c : c.text ?? ""))
                      .join("")
                  : String(chunk.content ?? "");

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
        } catch (err) {
          console.error("LangChain stream error:", err);
          controller.error(err);
          return;
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    console.error("LangChain diagram generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}

