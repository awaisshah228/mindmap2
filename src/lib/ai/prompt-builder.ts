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

Node types: mindMap, stickyNote, rectangle, diamond, circle, document, text, image, databaseSchema, service, queue, actor, icon, group.

POSITIONING RULES — THIS IS CRITICAL:
Layout: preferred layoutDirection is ${preferredLayoutDirection}. Each node MUST have an explicit position {x: number, y: number} as exact canvas coordinates.
- Place the first/central node at position {x: 0, y: 0}.
- Space nodes generously: minimum 300px apart on the X axis and 250px apart on the Y axis.
- For horizontal flows (left→right): increment x by 350–450 for each column, y by 280–350 for each row.
- For vertical flows (top→bottom): increment y by 300–400 for each row, x by 350–450 for each column.
- Use positions in range [-2000, 2000]. Align in clear rows/columns.
- NEVER stack nodes at the same position. Each node MUST have a unique {x, y}.

Schema: nodes have id, type, position {x,y}. For groups: type "group", style {width, height}. For nodes inside a group: "parentNode": "<group-id>", position relative to group (e.g. 20, 50). data: label, shape?, icon?, imageUrl?, subtitle?, columns? (for databaseSchema), annotation? (floating label below node).

EDGES: id, source, target, sourceHandle ("left"|"right"|"top"|"bottom"), targetHandle ("left"|"right"|"top"|"bottom"). data.label? (e.g. "HTTP", "Calls", "Queries"). data.connectionLength? (number, the pixel distance between source and target nodes — typically 300–500). Always set sourceHandle and targetHandle to match the flow direction.

Icons: We use lucide-react and react-icons (si, fa). Set data.icon only to one of: ${ICON_IDS_FOR_PROMPT}. Defaults: services "lucide:server", data stores "lucide:database". Never use an icon not in this list.

Icon nodes: type "icon" with data.iconId (from the icons list) or data.emoji (single emoji character, e.g. "🔥"). Use for decorative elements, markers, or standalone icons on the canvas. Size: 64x64.

Annotations: Any node can have data.annotation — a short floating label that appears below the node (e.g. "v2.1", "Primary", "Deprecated", "Production"). Use annotations to add context without cluttering the main label.

Mind map (only when user asks for mind map): type "mindMap", central node at (0,0). First-level children at x ±400, y offset ±300 from center. Each subsequent level adds ±350 x offset. If mode=mindmap-refine and focusNodeId set: add only children of that node; source=focusNodeId for every new edge.

Architecture: rectangle for services/queues/gateways, document/text for notes, circle for start/end. Clear path (e.g. User→Frontend→API→Services→DB). Set data.icon on every rectangle/circle/document so no plain text-only nodes.

SUBFLOWS & GROUPING (USE EXTENSIVELY):
Groups organize related nodes into logical clusters. USE GROUPS LIBERALLY — real-world systems have clear boundaries:
- Use type "group" for: cloud providers (AWS, GCP, Azure), environments (Production, Staging), layers (Frontend, Backend, Data), services clusters (Microservices, APIs), infrastructure (Kubernetes, Docker), teams, regions, etc.
- Group node: type "group", id, data.label, position {x,y}, style {width: 400–700, height: 300–600}.
- Child nodes inside the group: set "parentNode" to the group's id; position {x,y} is RELATIVE to the group origin (e.g. {x: 30, y: 50}).
- IMPORTANT: Define the group node BEFORE any child node that references it as parentNode in the nodes array.
- Nest groups for hierarchy: e.g. "Cloud" group contains "Compute" and "Storage" subgroups.
- Edges can connect across groups: e.g. source "frontend" (top-level) → target "api-gw" (inside "backend" group).
- For architecture diagrams with 5+ components, ALWAYS use at least 1–3 groups.
- For complex systems (10+ nodes), use 3–5 groups with possible nesting.
- Space groups well apart (600–800px between groups).
- Inside groups, space child nodes 200–300px apart.
- Groups should have descriptive labels: "Backend Services", "AWS Cloud", "Database Layer", "CI/CD Pipeline", etc.

Flowchart: rectangle=step, diamond=decision, circle=start/end. Flow top→bottom or left→right. Group related decision branches.

Special types: databaseSchema → data.columns [{name, type?, key?}]. service → data.subtitle optional. queue/actor → data.label.

Images: type "image" with data.imageUrl = https://picsum.photos/seed/<word>/200/150 (seed: user, api, database, server, etc.). data.label = short caption.

Rules: Short labels (2–5 words). Unique ids. Edges reference node ids. Non-mindMap: add edge.data.label where helpful (e.g. "HTTP", "REST", "gRPC", "Pub/Sub"). Add data.connectionLength on each edge (300–500 pixels). Always add data.icon or imageUrl for most nodes; never all plain rectangles. Use diverse node types (mix rectangle, circle, databaseSchema, service, queue, actor, icon, image) for visual variety.
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
              "Type: architecture. Services, APIs, gateways, data stores; use data.icon or image nodes. MUST use groups to organize services into logical layers (e.g. Frontend, Backend, Data, Infrastructure). Use diverse node types.",
            flowchart:
              "Type: flowchart. Rectangles (steps), diamonds (decisions), circles (start/end). Group related steps into phases or stages using group nodes.",
            sequence: "Type: sequence. Actors and interactions, clear lanes. Group actors by team/system.",
            "entity-relationship": "Type: ER. Entities and relationships. Use databaseSchema nodes with columns. Group related entities.",
            bpmn: "Type: BPMN. Tasks, gateways, flows. Group by swim lanes using group nodes.",
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
