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

export interface MindMapStructure {
  pathFromRoot: { id: string; label: string }[];
  focusNode: { id: string; label: string };
  existingChildren: { id: string; label: string }[];
}

/** Build path from root to focus and list of existing children for mindmap-refine context. */
export function getMindMapStructure(
  nodes: { id: string; data?: { label?: string }; [k: string]: unknown }[],
  edges: { source: string; target: string; [k: string]: unknown }[],
  focusNodeId: string
): MindMapStructure | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const focus = nodeMap.get(focusNodeId);
  if (!focus) return null;

  const targets = new Set(edges.map((e) => e.target));
  const roots = nodes.filter((n) => !targets.has(n.id));
  const parent = new Map<string, string>();
  for (const e of edges) parent.set(e.target, e.source);

  const getPathTo = (fromRootId: string, toId: string): string[] | null => {
    const path: string[] = [];
    let cur: string | undefined = toId;
    while (cur) {
      path.push(cur);
      if (cur === fromRootId) return path.reverse();
      cur = parent.get(cur);
    }
    return null;
  };

  let pathIds: string[] = [];
  for (const r of roots) {
    const p = getPathTo(r.id, focusNodeId);
    if (p) {
      pathIds = p;
      break;
    }
  }
  if (pathIds.length === 0) pathIds = [focusNodeId];

  const pathFromRoot = pathIds.map((id) => {
    const n = nodeMap.get(id);
    return { id, label: (n?.data as { label?: string } | undefined)?.label ?? id };
  });

  const existingChildren = edges
    .filter((e) => e.source === focusNodeId)
    .map((e) => {
      const n = nodeMap.get(e.target);
      return { id: e.target, label: (n?.data as { label?: string } | undefined)?.label ?? e.target };
    });

  const focusLabel = (focus.data as { label?: string } | undefined)?.label ?? focusNodeId;
  return {
    pathFromRoot,
    focusNode: { id: focusNodeId, label: focusLabel },
    existingChildren,
  };
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
  mindMapStructure?: MindMapStructure | null;
}

export function buildSystemPrompt(layoutDirection?: string): string {
  const isVertical = layoutDirection === "vertical";
  const preferredLayoutDirection = isVertical ? "vertical" : "horizontal";

  const handleRule =
    isVertical
      ? `EDGE HANDLES (MANDATORY — vertical layout): Use sourceHandle "bottom" and targetHandle "top" on EVERY edge. Edges must leave the parent/source from its BOTTOM and connect to the child/target at its TOP. This keeps the flow top→bottom and connections clean.`
      : `EDGE HANDLES (MANDATORY — horizontal layout): Use sourceHandle "right" and targetHandle "left" on EVERY edge. Edges must leave the parent/source from its RIGHT side and connect to the child/target on its LEFT side. This keeps the flow left→right and connections clean.`;

  return `
You design diagrams for a React Flow whiteboard. Return only valid JSON. No markdown, no comments.

CRITICAL — NODE TYPE SELECTION: Do NOT default to type "rectangle" for all nodes. Choose the semantically correct type for each node:
- mindMap: mind map nodes (central topic, branches). Use when diagram type is mind map.
- flowchart: rectangle = process/step, diamond = decision/branching, circle = start/end. Use data.shape for diamond/circle when type is rectangle.
- architecture/system: service, queue, actor — for services use "service", for message queues use "queue", for users/actors use "actor". Use "rectangle" only for generic boxes.
- entity-relationship: databaseSchema — for entities/tables with columns.
- stickyNote: callouts, notes, comments.
- document: document/file nodes.
- icon: standalone icons or decorative elements.
- image: when showing an image with data.imageUrl.
Available types: mindMap, stickyNote, rectangle, diamond, circle, document, text, image, databaseSchema, service, queue, actor, icon. Do NOT use type "group" — use the groups array instead.

LAYOUT & HANDLES:
Layout direction is ${preferredLayoutDirection}. Place nodes so that: (1) edges are short and do not cross unnecessarily, (2) the flow reads naturally in one direction, (3) connected nodes are close together. ${handleRule}
Give each node a position {x, y}; use modest gaps (100–200) between related nodes. Auto-layout will refine, but your structure and handle choices determine readability.

Schema: nodes have id, type, position {x,y}. All nodes are top-level (no parentNode). data: label, shape?, icon?, imageUrl?, subtitle?, columns? (for databaseSchema), annotation?. For grouping: return an optional "groups" array: groups: [{ id: string, label: string, nodeIds: string[] }]. Each nodeIds lists the ids of nodes that belong to that group (e.g. "Frontend" group with nodeIds ["react-spa","cloudfront","s3"]). The app will lay out all nodes flat, then apply grouping visually. Use at most 2–4 groups when they clarify the diagram; omit groups when not needed.

EDGES — CLEAN CONNECTIONS:
Every edge MUST have: id (unique), source (exact node id), target (exact node id), sourceHandle, targetHandle. ${handleRule}
Edge labels (data.label): Add ONLY when the relationship is not obvious from the node names — e.g. protocol (HTTP, gRPC), event type (OrderCreated), relationship (references, belongs to), or flow type (Pub/Sub, WebSockets). Omit data.label when self-explanatory. Keep labels short (1–3 words). When you add a label, space nodes so the edge has enough length; the UI hides labels on edges that are too short. Accurate source/target and correct handles prevent tangled connections. Keep the graph simple: avoid one node connecting to too many others; prefer a clear directional flow so the reader can follow it easily.

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

Mind map (only when user asks for mind map): type "mindMap", central node at (0,0). First-level children at x ±400, y offset ±300 from center. Each subsequent level adds ±350 x offset.
MIND MAP REFINE (mode=mindmap-refine): The user selected a node and wants to extend or redraw that branch. You will receive the current branch structure (path from root, focus node, existing children). Interpret the user prompt: (1) If they ask to "add children", "more ideas", "expand", "sub-topics" — return ONLY new child nodes and edges (source=focusNodeId for every new edge). (2) If they ask to "redraw", "rework", "improve" this branch — return new nodes that replace or extend the branch, keeping context from the path when relevant. (3) Always use the exact focusNodeId as source for every new edge. Return valid diagram JSON (nodes + edges). New nodes should have type "mindMap", short labels, and data.icon or data.emoji. Do not duplicate existing children; add new ideas that fit the focus node topic.

Architecture / system design: HIGH-LEVEL VIEW ONLY. Show components as services, rectangles, queues — not as detailed schemas. For databases and data stores (MongoDB, Redis, PostgreSQL, etc.) use type "service" or "rectangle" with a short label (e.g. "MongoDB Atlas", "Redis", "PostgreSQL"). Do NOT use type "databaseSchema" or list tables/columns in architecture diagrams. Save databaseSchema (tables with columns) only for entity-relationship or database schema diagram types. Clear path (e.g. User→Frontend→API→Services→DB). Set data.icon AND data.iconUrl on every node. Use brand icons via iconUrl.

GROUPS — METADATA ONLY (app applies grouping like Ctrl+G):
- Do NOT create nodes with type "group" or parentNode. Return a "groups" array: groups: [{ id: string, label: string, nodeIds: string[] }]. Each entry names a group (e.g. "Frontend", "Backend") and lists the node ids that belong to it. The app lays out all nodes flat, then applies grouping to those nodeIds (same as user selecting nodes and using group/subflow or Ctrl+G). Use at most 2–4 groups when they clarify the diagram; omit groups when not needed.

Flowchart: MUST use type "diamond" for decisions (not rectangle), type "circle" for start/end. Use type "rectangle" only for process steps. Set data.shape: "diamond" or "circle" when using ShapeNode. Flow top→bottom or left→right. Group related decision branches.

Special types: databaseSchema → use ONLY for entity-relationship or schema diagrams; data.columns [{name, type?, key?}]. For architecture/system design use "service" or "rectangle" for data stores (no columns). service → data.subtitle optional. queue/actor → data.label.

Images: type "image" with data.imageUrl = https://picsum.photos/seed/<word>/200/150 (seed: user, api, database, server, etc.). data.label = short caption.

Rules: Unique node ids. Every edge MUST use the correct handles for the layout: horizontal → sourceHandle "right", targetHandle "left"; vertical → sourceHandle "bottom", targetHandle "top". Every edge: source, target, sourceHandle, targetHandle; data.label only when it adds information (omit when self-explanatory); keep edge labels 1–3 words. Short node labels (2–5 words). For longer descriptions or paragraphs (e.g. notes, callouts, body text), use type "text" — text-only nodes without a shape, which scale to fit content. For shape nodes (rectangle, diamond, etc.) keep labels short so text fits the shape; shapes auto-scale to short text. Every node: data.icon, data.iconUrl, or data.emoji. For architecture/system design: high-level view only — use service/rectangle for databases. Use databaseSchema only for entity-relationship or schema diagram type. Place nodes so the flow matches the handle rule above. Center the diagram in the canvas; layout will fit and center the view.
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
              "Type: flowchart. Use type 'rectangle' for process steps, type 'diamond' for decisions (NOT rectangle), type 'circle' for start/end. One clear direction (top→bottom or left→right). Use groups array to group phases. Label edges for decision outcomes (Yes/No). Good data: short step labels, correct type per node role.",
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

  // Mind map refine: inject current tree structure so AI can add children or redraw with context
  let mindMapContext = "";
  const { mindMapStructure } = params;
  if (isMindmapRefine && mindMapStructure) {
    const pathLabels = mindMapStructure.pathFromRoot.map((n) => n.label).join(" → ");
    const childLabels = mindMapStructure.existingChildren.map((n) => n.label).join(", ") || "(none yet)";
    mindMapContext = `

MIND MAP REFINE — CURRENT TREE STRUCTURE (use this context):
- Path from root to selected node: ${pathLabels}
- Focus node (selected): id="${mindMapStructure.focusNode.id}", label="${mindMapStructure.focusNode.label}"
- Existing children of this node: ${childLabels}

Interpret the user prompt below: if they want to add more ideas or children, return ONLY new child nodes with edges from focus node (source="${mindMapStructure.focusNode.id}"). If they want to redraw or expand the branch, return new nodes that fit the topic and keep the path context when relevant. Do not duplicate existing children.`;
  }

  // Tell the AI about existing canvas content so it places nodes in blank areas
  let canvasContext = "";
  if (canvasBounds && canvasBounds.nodeCount > 0 && !isMindmapRefine) {
    canvasContext = `\n\nCANVAS CONTEXT: The canvas already has ${canvasBounds.nodeCount} nodes occupying the area from (${Math.round(canvasBounds.minX)}, ${Math.round(canvasBounds.minY)}) to (${Math.round(canvasBounds.maxX)}, ${Math.round(canvasBounds.maxY)}). Place your new diagram BELOW the existing content — start your first node at approximately (${Math.round(canvasBounds.minX)}, ${Math.round(canvasBounds.maxY + 400)}). Do NOT overlap with existing nodes.`;
  }

  if (previousDiagram && Object.keys(previousDiagram).length > 0) {
    return `${typeBlock}${prompt}\n\n${meta}${mindMapContext}${canvasContext}\n\nPrevious prompt: ${previousPrompt ?? "—"}\n\nPrevious diagram:\n${JSON.stringify(previousDiagram)}\n\nReturn full diagram JSON only.${isMindmapRefine ? " New edges from the focus node must have source=\"" + (focusNodeId ?? "") + "\"." : ""}`;
  }
  return `${typeBlock}${prompt}\n\n${meta}${mindMapContext}${canvasContext}\n\nReturn diagram JSON only.${isMindmapRefine ? " New edges from the focus node must have source=\"" + (focusNodeId ?? "") + "\"." : ""}`;
}
