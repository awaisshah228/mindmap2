/**
 * Shared prompt builder for AI diagram generation.
 * Used by both the server-side langchain route and the client-side direct API call.
 */

import { ICON_IDS_FOR_PROMPT } from "@/lib/icon-prompt-list";

export interface PromptParams {
  prompt: string;
  layoutDirection?: string;
  mode?: string;
  focusNodeId?: string | null;
  diagramType?: string;
  previousPrompt?: string | null;
  previousDiagram?: Record<string, unknown> | null;
}

export function buildSystemPrompt(layoutDirection?: string): string {
  const preferredLayoutDirection =
    layoutDirection === "vertical" ? "vertical" : "horizontal";

  return `
You design diagrams for a React Flow whiteboard. Return only valid JSON matching the schema below. No markdown, no comments.

Node types: mindMap, stickyNote, rectangle, diamond, circle, document, text, image, databaseSchema, service, queue, actor, group.

POSITIONING RULES — THIS IS CRITICAL:
Layout: preferred layoutDirection is ${preferredLayoutDirection}. Each node MUST have an explicit position {x: number, y: number} as exact canvas coordinates.
- Place the first/central node at position {x: 0, y: 0}.
- Space nodes generously: minimum 300px apart on the X axis and 250px apart on the Y axis.
- For horizontal flows (left→right): increment x by 350–450 for each column, y by 280–350 for each row.
- For vertical flows (top→bottom): increment y by 300–400 for each row, x by 350–450 for each column.
- Use positions in range [-2000, 2000]. Align in clear rows/columns.
- NEVER stack nodes at the same position. Each node MUST have a unique {x, y}.

Schema: nodes have id, type, position {x,y}. For groups: type "group", style {width, height}. For nodes inside a group: "parentNode": "<group-id>", position relative to group (e.g. 10, 20). data: label, shape?, icon?, imageUrl?, subtitle?, columns? (for databaseSchema).

EDGES: id, source, target, sourceHandle ("left"|"right"|"top"|"bottom"), targetHandle ("left"|"right"|"top"|"bottom"). data.label? (e.g. "HTTP", "Calls", "Queries"). data.connectionLength? (number, the pixel distance between source and target nodes — typically 300–500). Always set sourceHandle and targetHandle to match the flow direction.

Icons: We use lucide-react and react-icons (si, fa). Set data.icon only to one of: ${ICON_IDS_FOR_PROMPT}. Defaults: services "lucide:server", data stores "lucide:database". Never use an icon not in this list.

Mind map (only when user asks for mind map): type "mindMap", central node at (0,0). First-level children at x ±400, y offset ±300 from center. Each subsequent level adds ±350 x offset. If mode=mindmap-refine and focusNodeId set: add only children of that node; source=focusNodeId for every new edge.

Architecture: rectangle for services/queues/gateways, document/text for notes, circle for start/end. Clear path (e.g. User→Frontend→API→Services→DB). Set data.icon on every rectangle/circle/document so no plain text-only nodes.

Subflows (parent-child grouping): Use type "group" for logical clusters that contain multiple nodes. Keep single concepts as top-level nodes (e.g. User, Frontend = one node each). Use groups for: "Backend", "AWS", "GCP", "API layer", "Services" — any container that has several nodes inside. Group node: type "group", id, data.label (e.g. "Backend", "AWS"), position {x,y}, style {width, height} (e.g. 400–600 width, 300–500 height). Child nodes inside the group: set "parentNode" to the group's id; position {x,y} is relative to the group (e.g. 20–80, 30–100). You can nest groups: inner group has parentNode = outer group id, its children have parentNode = inner group id. Edges can connect across: e.g. source "frontend" (top-level) target "api-gw" (node inside group "backend"). Define the group node before any node that references it as parentNode.

Flowchart: rectangle=step, diamond=decision, circle=start/end. Flow top→bottom or left→right.

Special types: databaseSchema → data.columns [{name, type?, key?}]. service → data.subtitle optional. queue/actor → data.label.

Images: type "image" with data.imageUrl = https://picsum.photos/seed/<word>/200/150 (seed: user, api, database, server, etc.). data.label = short caption.

Rules: Short labels (2–5 words). Unique ids. Edges reference node ids. Non-mindMap: add edge.data.label where helpful (e.g. "HTTP", "Calls"). Add data.connectionLength on each edge (300–500 pixels). Always add data.icon or imageUrl for most nodes; never all plain rectangles.
`.trim();
}

export function buildUserMessage(params: PromptParams): string {
  const {
    prompt,
    layoutDirection,
    mode,
    focusNodeId,
    diagramType,
    previousPrompt,
    previousDiagram,
  } = params;

  const preferredLayoutDirection =
    layoutDirection === "vertical" ? "vertical" : "horizontal";

  const isMindmapRefine = mode === "mindmap-refine" && focusNodeId;

  const diagramTypeHint =
    diagramType && diagramType !== "auto"
      ? (() => {
          const hints: Record<string, string> = {
            mindmap:
              "Type: mind map. Central topic + branches, all nodes mindMap.",
            architecture:
              "Type: architecture. Services, APIs, gateways, data stores; use data.icon or image nodes.",
            flowchart:
              "Type: flowchart. Rectangles (steps), diamonds (decisions), circles (start/end).",
            sequence: "Type: sequence. Actors and interactions, clear lanes.",
            "entity-relationship": "Type: ER. Entities and relationships.",
            bpmn: "Type: BPMN. Tasks, gateways, flows.",
          };
          return hints[diagramType] ?? "";
        })()
      : "";

  const typeBlock = diagramTypeHint ? `${diagramTypeHint}\n\n` : "";
  const meta = `Mode: ${isMindmapRefine ? "mindmap-refine" : "diagram"}. focusNodeId: ${focusNodeId ?? "—"}. layout: ${preferredLayoutDirection}.`;

  if (previousDiagram && Object.keys(previousDiagram).length > 0) {
    return `${typeBlock}${prompt}\n\n${meta}\n\nPrevious prompt: ${previousPrompt ?? "—"}\n\nPrevious diagram:\n${JSON.stringify(previousDiagram)}\n\nReturn full diagram JSON only.${isMindmapRefine ? " Extend only the focused node's branch." : ""}`;
  }
  return `${typeBlock}${prompt}\n\n${meta}\n\nReturn diagram JSON only.`;
}
