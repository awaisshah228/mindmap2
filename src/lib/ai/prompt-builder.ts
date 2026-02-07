/**
 * Shared prompt builder for AI diagram generation.
 * Used by both the server-side langchain route and the client-side direct API call.
 */

import { ICON_IDS_FOR_PROMPT } from "@/lib/icon-prompt-list";
import { MARKER_IDS_FOR_PROMPT } from "@/lib/marker-prompt-list";

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

function formatMarkerIdsForPrompt(
  markers: { id: string; label: string; group: "basic" | "er" | "uml" }[] | undefined
): string {
  const list = Array.isArray(markers) ? markers : [];
  const byGroup = { basic: [] as string[], er: [] as string[], uml: [] as string[] };
  for (const m of list) byGroup[m.group].push(m.id);
  const lines: string[] = [];
  if (byGroup.basic.length) lines.push(`- Basic: ${byGroup.basic.join(", ")}.`);
  if (byGroup.er.length) lines.push(`- ER / cardinality: ${byGroup.er.join(", ")}.`);
  if (byGroup.uml.length) lines.push(`- UML: ${byGroup.uml.join(", ")}.`);
  return lines.length ? lines.join("\n") : "- Basic: cm-arrow-open, cm-arrow-closed, cm-circle, cm-circle-filled, cm-diamond, cm-diamond-filled, cm-bar.\n- ER / cardinality: cm-er-one, cm-er-many, cm-er-one-only, cm-er-zero-or-one, cm-er-one-or-many, cm-er-zero-or-many.\n- UML: cm-uml-composition, cm-uml-aggregation, cm-uml-inheritance, cm-uml-realization.";
}

export function buildSystemPrompt(layoutDirection?: string): string {
  const isVertical = layoutDirection === "vertical";
  const preferredLayoutDirection = isVertical ? "vertical" : "horizontal";

  return `
You design diagrams for a React Flow whiteboard. Return only valid JSON. No markdown, no comments.

NO POSITIONS, NO HANDLES — AUTO-LAYOUT ONLY:
- Do NOT include "position" in nodes. Return nodes with id, type, and data only. The app uses auto-layout to position everything.
- Do NOT include "sourceHandle" or "targetHandle" in edges. Return edges with id, source, target, and optional data only. The app determines connection points from the layout.
- Your job: define WHAT nodes exist and HOW they connect. The app handles WHERE they appear on the canvas.

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

STRUCTURE — WHAT TO RETURN (single JSON object; the app renders in batches for a smooth diagram):
- Return one JSON object: { "nodes": [ ... ], "edges": [ ... ], "groups"?: [ ... ] }. No nested chunks — flat nodes and edges arrays. The app draws in batches of 5+ nodes at a time.
- Nodes: id (string), type, data { label, shape?, icon?, iconUrl?, emoji?, imageUrl?, subtitle?, annotation?, columns? }. NO position.
- Edges: id (unique), source (exact node id), target (exact node id), data { label?, strokeColor?, flowDirection?, markerEnd?, markerStart? }. NO sourceHandle, NO targetHandle.
  flowDirection: "mono" (→ one-way arrow at target), "bi" (↔ arrows at both ends), "none" (— no arrows, plain line).
  markerEnd / markerStart (optional): only when you need a non-arrow symbol; use IDs from our marker library below. If you omit both, the app applies arrows from flowDirection (mono = arrow at target, bi = arrows both ends, none = no marker).
- groups (optional): [{ id, label, nodeIds }] — cluster related nodes. Use 2–4 groups for architecture diagrams with 6+ nodes.

EDGE MARKERS — FROM OUR MARKER LIBRARY (use only these exact IDs):
When you need a specific symbol (not the default arrow), set data.markerEnd (target side) and/or data.markerStart (source side) to one of the IDs below. When you need NO marker: set flowDirection to "none" and omit markerEnd/markerStart — the edge will render as a plain line. When you need the default arrow: omit markerEnd/markerStart and use flowDirection "mono" (arrow at target) or "bi" (arrows at both ends); the app will apply the arrow automatically.

Marker library — all available markers (use the id exactly as written):
${formatMarkerIdsForPrompt(MARKER_IDS_FOR_PROMPT)}

When to use markers vs default arrow:
- Flowcharts, sequences, architecture flows: omit markerEnd/markerStart; use flowDirection "mono" or "bi" so the app draws arrows.
- Entity-relationship: use data.markerEnd / data.markerStart with cm-er-* IDs (e.g. cm-er-one, cm-er-many).
- UML class diagrams: use cm-uml-inheritance, cm-uml-composition, cm-uml-aggregation, cm-uml-realization as needed.
- No arrow / plain line: use flowDirection "none" and omit markers.

EDGES — CLEAN CONNECTIONS (MINIMIZE INTERSECTIONS):
Every edge: id, source, target. Optional data.label, data.strokeColor, data.flowDirection, data.markerEnd, data.markerStart.
KEEP EDGES MINIMAL: Only add edges that convey essential relationships. Omit redundant or obvious connections. Prefer a clear linear flow (A→B→C) over a dense mesh. Aim for max 3–4 edges per node when possible. Fewer edges = cleaner diagram, fewer intersections.

Edge direction (data.flowDirection) — controls default arrow placement when you omit markerEnd/markerStart:
- "mono" (default): App draws one arrow at target. Use for flows, sequences, process steps, data flow (A→B).
- "bi": App draws arrows at both ends. Use for bidirectional flows (sync, request-response, mutual dependency).
- "none": No marker; plain line. Use for undirected relationships or when you want no arrow.
When direction matters (flowcharts, sequences, architecture, BPMN), use "mono" or "bi" and omit markers to get arrows. When you want no arrow, use "none". For ER/UML, set markerEnd/markerStart from the marker library and flowDirection as needed.

Edge labels (data.label): Add ONLY when the relationship is not obvious — e.g. protocol (HTTP, gRPC), event type. Keep to 1–3 words. Omit when self-explanatory.

Edge border color (data.strokeColor): Use to distinguish different connection types so readers can tell flows apart. Optional but recommended when the diagram has multiple kinds of connections (e.g. data flow vs control flow, or different subsystems). Use valid CSS colors: hex (e.g. "#3b82f6", "#22c55e") or rgb (e.g. "rgb(59 130 246)"). Suggested palette: blue "#3b82f6", green "#22c55e", amber "#eab308", orange "#f97316", pink "#ec4899", violet "#8b5cf6", teal "#14b8a6", red "#ef4444". Use the same strokeColor for edges of the same logical type (e.g. all "data" edges blue, all "control" edges green). Omit strokeColor when a single default color is fine.

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

Mind map (only when user asks for mind map): type "mindMap". One root, children connect via edges. No positions — auto-layout arranges the tree.
MIND MAP REFINE (mode=mindmap-refine): The user selected a node and wants to extend or redraw that branch. You will receive the current branch structure (path from root, focus node, existing children). Interpret the user prompt: (1) If they ask to "add children", "more ideas", "expand", "sub-topics" — return ONLY new child nodes and edges (source=focusNodeId for every new edge). (2) If they ask to "redraw", "rework", "improve" this branch — return new nodes that replace or extend the branch, keeping context from the path when relevant. (3) Always use the exact focusNodeId as source for every new edge. Return valid diagram JSON (nodes + edges). New nodes should have type "mindMap", short labels, and data.icon or data.emoji. Do not duplicate existing children; add new ideas that fit the focus node topic.

Architecture / system design: HIGH-LEVEL VIEW ONLY. Service/rectangle/queue nodes, short labels. No databaseSchema. Clear flow (User→Frontend→API→Services→DB). Set data.icon AND data.iconUrl on every node. GROUPS: Always use 2–4 groups (Frontend, Backend, Data, External). Minimize edges; prefer one primary flow per subsystem. No positions — auto-layout handles placement.

GROUPS — METADATA ONLY (CRITICAL FOR CLEAN LAYOUT):
- Do NOT create nodes with type "group" or parentNode. Return a "groups" array: groups: [{ id: string, label: string, nodeIds: string[] }]. Each entry names a group (e.g. "Frontend", "Backend", "Data", "Authentication") and lists the node ids that belong to it. The app lays out nodes and applies grouping for clear visual separation.
- For architecture/system diagrams with 6+ nodes: ALWAYS use 2–4 groups to cluster related components (Client, Frontend, API, Services, Data, External). This reduces visual clutter and creates aligned, readable sections.
- Group nodes that share the same tier or subsystem. Avoid empty or single-node groups unless semantically important.

Flowchart: MUST use type "diamond" for decisions (not rectangle), type "circle" for start/end. Use type "rectangle" only for process steps. Set data.shape: "diamond" or "circle" when using ShapeNode. Flow top→bottom or left→right. Group related decision branches.

Special types: databaseSchema → ONLY for entity-relationship diagrams; data.columns [{name, type?, key?}]. For architecture use "service" or "rectangle" for data stores. service → data.subtitle optional. queue/actor → data.label. ER: Groups for domains (Core, Billing, Auth). No positions.

Images: type "image" with data.imageUrl = https://picsum.photos/seed/<word>/200/150 (seed: user, api, database, server, etc.). data.label = short caption.

REMOVE UNNECESSARY ELEMENTS: Do not add decorative nodes, duplicate connections, or redundant edges. One edge per logical relationship. No orphan nodes. Omit annotations unless they add real value.

Rules: Unique node ids. Nodes: id, type, data (no position). Edges: id, source, target, optional data (no handles). Short node labels (2–5 words). Every node: data.icon, data.iconUrl, or data.emoji. Auto-layout positions everything; you define structure only.

COMPLETE YET CLEAN DIAGRAMS: Include every component the user describes, but keep the graph minimal. One edge per relationship. No duplicate or redundant edges. No orphan nodes. All edges must reference valid source and target node ids. Prefer fewer, clearer edges over a dense mesh.
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
              "Type: mind map. One central topic, all nodes type mindMap. Branches with clear hierarchy. Edge labels only if they name the branch theme; usually omit. Good data: short labels, icons/emoji on every node. No positions or handles.",
            architecture:
              "Type: architecture — high-level system design only. Service or rectangle nodes, short labels. No databaseSchema. Groups: Frontend, Backend, Data, External (2–4 groups). Edge labels for protocols (REST, gRPC, Pub/Sub). Set data.flowDirection: \"mono\" on edges to show data/control flow direction; \"bi\" for request-response pairs. data.icon + data.iconUrl on every node. Minimize edges. No positions or handles.",
            flowchart:
              "Type: flowchart. Rectangle for steps, diamond for decisions, circle for start/end. Groups for phases. Set data.flowDirection: \"mono\" on all edges to show flow direction (arrows at target). Label edges for Yes/No on decisions. No positions or handles.",
            sequence:
              "Type: sequence. Use type \"actor\" for participants (User, Client, Server, API). Place actors in groups (one per participant). Edges = messages/calls. Set data.flowDirection: \"mono\" on every edge to show message direction. Label edges with message names (e.g. \"login\", \"fetch data\"). Flow: top-to-bottom (first message at top). No positions or handles.",
            "entity-relationship":
              "Type: ER. databaseSchema with data.columns (name, type?, key?). Groups for domains. Edge labels for relationships. No positions or handles.",
            bpmn:
              "Type: BPMN. Tasks (type rectangle, data.shape optional), gateways (type diamond), events (type circle). Groups = swim lanes (e.g. \"Customer\", \"System\"). Flow: Start Event → Task → Gateway → Task → End Event. Set data.flowDirection: \"mono\" on edges to show process flow direction. Label gateway edges Yes/No. Use data.shape for circle (start/end) and diamond (gateway). No positions or handles.",
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
    canvasContext = `\n\nCANVAS CONTEXT: The canvas already has ${canvasBounds.nodeCount} nodes. Your new diagram will be placed below the existing content automatically. No positions needed.`;
  }

  if (previousDiagram && Object.keys(previousDiagram).length > 0) {
    return `${typeBlock}${prompt}\n\n${meta}${mindMapContext}${canvasContext}\n\nPrevious prompt: ${previousPrompt ?? "—"}\n\nPrevious diagram:\n${JSON.stringify(previousDiagram)}\n\nReturn full diagram JSON only.${isMindmapRefine ? " New edges from the focus node must have source=\"" + (focusNodeId ?? "") + "\"." : ""}`;
  }
  return `${typeBlock}${prompt}\n\n${meta}${mindMapContext}${canvasContext}\n\nReturn diagram JSON only.${isMindmapRefine ? " New edges from the focus node must have source=\"" + (focusNodeId ?? "") + "\"." : ""}`;
}
