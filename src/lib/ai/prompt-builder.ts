/**
 * Shared prompt builder for AI diagram generation.
 * Used by both the server-side langchain route and the client-side direct API call.
 */

import { ICON_IDS_FOR_PROMPT } from "@/lib/icon-prompt-list";

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  nodeCount: number;
}

export interface PromptParams {
  prompt: string;
  layoutDirection?: string;
  mode?: string;
  focusNodeId?: string | null;
  diagramType?: string;
  previousPrompt?: string | null;
  previousDiagram?: Record<string, unknown> | null;
  canvasBounds?: CanvasBounds | null;
}

export function buildSystemPrompt(layoutDirection?: string): string {
  const preferredLayoutDirection =
    layoutDirection === "vertical" ? "vertical" : "horizontal";

  return `
You design diagrams for a React Flow whiteboard. Return only valid JSON. No markdown, no comments.

Node types: mindMap, stickyNote, rectangle, diamond, circle, document, text, image, databaseSchema, service, queue, actor, icon. Do NOT use type "group" — use the groups array instead.

PLACEMENT — FULL AUTONOMY:
You decide the logical order and arrangement of nodes. Give each node a position {x: number, y: number}. Use any coordinates you like (e.g. 0,0 for first node; spread others in the order you want). The canvas will run an auto-layout to arrange nodes clearly — so focus on correct structure and edges, not exact pixel positions. Keep connected components close: use modest coordinate gaps (e.g. 100–200 between related nodes) so edges stay short and the flow is easy to follow. Avoid large gaps that create long, hard-to-follow edges. Only rule: give each node a unique position so no two nodes share the same {x, y}.

Schema: nodes have id, type, position {x,y}. All nodes are top-level (no parentNode). data: label, shape?, icon?, imageUrl?, subtitle?, columns? (for databaseSchema), annotation?. For grouping: return an optional "groups" array: groups: [{ id: string, label: string, nodeIds: string[] }]. Each nodeIds lists the ids of nodes that belong to that group (e.g. "Frontend" group with nodeIds ["react-spa","cloudfront","s3"]). The app will lay out all nodes flat, then apply grouping visually. Use at most 2–4 groups when they clarify the diagram; omit groups when not needed.

EDGES — CRITICAL FOR CLEAN CONNECTIONS:
Every edge MUST have: id (unique), source (exact node id), target (exact node id), sourceHandle, targetHandle. Use handles so the flow direction is clear: e.g. left→right flow use sourceHandle "right" and targetHandle "left"; top→bottom use "bottom" and "top".
Edge labels (data.label): Add ONLY when the relationship is not obvious from the node names — e.g. protocol (HTTP, gRPC), event type (OrderCreated), relationship (references, belongs to), or flow type (Pub/Sub, WebSockets). Omit data.label when self-explanatory (e.g. User → Login, API → Database "Queries" can help; Frontend → API often needs no label). Keep labels short (1–3 words). When you do add a label, space the nodes so the edge has enough length (avoid very short edges between labeled connections); the UI hides labels on edges that are too short to keep the edge visible. Accurate source/target and handles prevent tangled connections. Keep the graph simple: avoid one node connecting to too many others; prefer a clear left-to-right or top-to-bottom flow.

Icons — ICON FALLBACK CHAIN (follow this priority):
1. FIRST try our installed icon library: Set data.icon to one of: ${ICON_IDS_FOR_PROMPT}. Defaults: services "lucide:server", data stores "lucide:database". Only use ids from this list for data.icon.
2. ALSO provide data.iconUrl — a publicly accessible URL to a relevant icon/logo image (PNG/SVG). Use real, well-known CDN icon URLs. Examples:
   - AWS: "https://cdn.simpleicons.org/amazonaws/FF9900"
   - Docker: "https://cdn.simpleicons.org/docker/2496ED"
   - Kubernetes: "https://cdn.simpleicons.org/kubernetes/326CE5"
   - PostgreSQL: "https://cdn.simpleicons.org/postgresql/4169E1"
   - Redis: "https://cdn.simpleicons.org/redis/DC382D"
   - Node.js: "https://cdn.simpleicons.org/nodedotjs/5FA04E"
   - React: "https://cdn.simpleicons.org/react/61DAFB"
   - Python: "https://cdn.simpleicons.org/python/3776AB"
   - GitHub: "https://cdn.simpleicons.org/github/181717"
   - GraphQL: "https://cdn.simpleicons.org/graphql/E10098"
   - Nginx: "https://cdn.simpleicons.org/nginx/009639"
   - Linux: "https://cdn.simpleicons.org/linux/FCC624"
   Use https://cdn.simpleicons.org/<slug>/<hex-color> for technology icons. For generic concepts, use data.icon from the library above or data.emoji instead.
3. If neither works, provide data.emoji (a single emoji character like "🔥", "🚀", "📦", "🔒").

EVERY node should have at least one of: data.icon, data.iconUrl, or data.emoji. Never leave nodes without a visual icon.

Icon nodes: type "icon" with data.iconId (from the icons list) or data.emoji (single emoji character, e.g. "🔥") or data.iconUrl (URL to icon image). Use for decorative elements, markers, or standalone icons on the canvas. Size: 64x64.

Annotations: Any node can have data.annotation — a short floating label that appears below the node (e.g. "v2.1", "Primary", "Deprecated", "Production"). Use annotations to add context without cluttering the main label.

Mind map (only when user asks for mind map): type "mindMap", central node at (0,0). First-level children at x ±400, y offset ±300 from center. Each subsequent level adds ±350 x offset. If mode=mindmap-refine and focusNodeId set: add only children of that node; source=focusNodeId for every new edge.

Architecture / system design: HIGH-LEVEL VIEW ONLY. Show components as services, rectangles, queues — not as detailed schemas. For databases and data stores (MongoDB, Redis, PostgreSQL, etc.) use type "service" or "rectangle" with a short label (e.g. "MongoDB Atlas", "Redis", "PostgreSQL"). Do NOT use type "databaseSchema" or list tables/columns in architecture diagrams. Save databaseSchema (tables with columns) only for entity-relationship or database schema diagram types. Clear path (e.g. User→Frontend→API→Services→DB). Set data.icon AND data.iconUrl on every node. Use brand icons via iconUrl.

GROUPS — METADATA ONLY (app applies grouping like Ctrl+G):
- Do NOT create nodes with type "group" or parentNode. Return a "groups" array: groups: [{ id: string, label: string, nodeIds: string[] }]. Each entry names a group (e.g. "Frontend", "Backend") and lists the node ids that belong to it. The app lays out all nodes flat, then applies grouping to those nodeIds (same as user selecting nodes and using group/subflow or Ctrl+G). Use at most 2–4 groups when they clarify the diagram; omit groups when not needed.

Flowchart: rectangle=step, diamond=decision, circle=start/end. Flow top→bottom or left→right. Group related decision branches.

Special types: databaseSchema → use ONLY for entity-relationship or schema diagrams; data.columns [{name, type?, key?}]. For architecture/system design use "service" or "rectangle" for data stores (no columns). service → data.subtitle optional. queue/actor → data.label.

Images: type "image" with data.imageUrl = https://picsum.photos/seed/<word>/200/150 (seed: user, api, database, server, etc.). data.label = short caption.

Rules: Unique node ids. Every edge: source, target, sourceHandle, targetHandle; data.label only when it adds information (omit when self-explanatory); keep edge labels 1–3 words; space nodes so edges have room when you add a label. Short node labels (2–5 words). Every node: data.icon, data.iconUrl, or data.emoji. For architecture/system design: high-level view only — use service/rectangle for databases (e.g. MongoDB, Redis), never databaseSchema with columns. Use databaseSchema only for entity-relationship or schema diagram type. Place nodes for clear flow; auto-layout will arrange.
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
    canvasBounds,
  } = params;

  const preferredLayoutDirection =
    layoutDirection === "vertical" ? "vertical" : "horizontal";

  const isMindmapRefine = mode === "mindmap-refine" && focusNodeId;

  const diagramTypeHint =
    diagramType && diagramType !== "auto"
      ? (() => {
          const hints: Record<string, string> = {
            mindmap:
              "Type: mind map. One central topic at (0,0), all nodes type mindMap. Branches with clear hierarchy. Edge labels only if they name the branch theme; usually omit — node labels are enough. Good data: short labels, icons/emoji on every node.",
            architecture:
              "Type: architecture — high-level system design only. Service or rectangle nodes, short labels (e.g. API Gateway, Redis, PostgreSQL). No databaseSchema or table columns. Use groups array for 2–4 layers (e.g. Frontend, Backend, Data, External). Left-to-right or top-to-bottom flow. Edge labels only when they add clarity (e.g. REST, gRPC, Pub/Sub, Queries); omit for obvious flows (User→Frontend, API→DB). Space nodes so labeled edges have room. Good data: data.icon + data.iconUrl on every node, 2–4 groups with clear nodeIds.",
            flowchart:
              "Type: flowchart. Rectangles = steps, diamonds = decisions, circles = start/end. One clear direction (top→bottom or left→right). Use groups array to group phases (e.g. Input, Process, Output). Label edges only for decision outcomes (Yes/No) or when the transition needs explanation; omit for simple step→step. Good data: short step labels, optional data.shape for diamond/circle.",
            sequence:
              "Type: sequence. Actors (left column or top row), interactions between them. Use groups to separate actors/systems. Edge labels for message or action (e.g. request, response, notify) when not obvious; omit when arrow direction is enough. Good data: actor labels, clear source/target and handles.",
            "entity-relationship":
              "Type: ER. databaseSchema nodes with data.columns (name, type?, key?). Groups for logical clusters (e.g. Core, Billing). Edge labels for relationship names when useful (e.g. references, one-to-many); omit for trivial FK links. Good data: columns with name/type/key, groups with nodeIds.",
            bpmn:
              "Type: BPMN. Tasks (rectangles), gateways (diamonds), events (circles). Groups for swim lanes (e.g. by role or system). Label edges for conditions or flow type when needed; omit when flow is clear. Good data: short task names, groups for lanes.",
          };
          return hints[diagramType] ?? "";
        })()
      : "";

  const typeBlock = diagramTypeHint ? `${diagramTypeHint}\n\n` : "";
  const meta = `Mode: ${isMindmapRefine ? "mindmap-refine" : "diagram"}. focusNodeId: ${focusNodeId ?? "—"}. layout: ${preferredLayoutDirection}.`;

  // Tell the AI about existing canvas content so it places nodes in blank areas
  let canvasContext = "";
  if (canvasBounds && canvasBounds.nodeCount > 0) {
    canvasContext = `\n\nCANVAS CONTEXT: The canvas already has ${canvasBounds.nodeCount} nodes occupying the area from (${Math.round(canvasBounds.minX)}, ${Math.round(canvasBounds.minY)}) to (${Math.round(canvasBounds.maxX)}, ${Math.round(canvasBounds.maxY)}). Place your new diagram BELOW the existing content — start your first node at approximately (${Math.round(canvasBounds.minX)}, ${Math.round(canvasBounds.maxY + 400)}). Do NOT overlap with existing nodes.`;
  }

  if (previousDiagram && Object.keys(previousDiagram).length > 0) {
    return `${typeBlock}${prompt}\n\n${meta}${canvasContext}\n\nPrevious prompt: ${previousPrompt ?? "—"}\n\nPrevious diagram:\n${JSON.stringify(previousDiagram)}\n\nReturn full diagram JSON only.${isMindmapRefine ? " Extend only the focused node's branch." : ""}`;
  }
  return `${typeBlock}${prompt}\n\n${meta}${canvasContext}\n\nReturn diagram JSON only.`;
}
