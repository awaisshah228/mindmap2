/**
 * Prompt for converting React Flow diagram (nodes + edges) to Excalidraw skeleton elements via LLM.
 * Optimized for: proper arrow bindings (lines connect to nodes), sizing, gaps, and edge labels.
 */

export interface DiagramInputNode {
  id: string;
  type?: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
}

export interface DiagramInputEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const SYSTEM_PROMPT = `You convert a React Flow diagram into an array of Excalidraw element skeletons. The output must render like the original: nodes as shapes, edges as arrows that CONNECT node-to-node.

CRITICAL — ARROW CONNECTIONS (like React Flow):
- Every arrow MUST have start: { id: "ex-<sourceNodeId>" } and end: { id: "ex-<targetNodeId>" }.
- Use the EXACT node ids from the input, prefixed with "ex-". Example: node "node-1" → id "ex-node-1".
- This makes the arrow lines connect from the source shape edge to the target shape edge. Without correct ids, arrows float unconnected.

OUTPUT FORMAT:
- Output ONLY a single JSON array. No markdown, no code fences, no explanation.
- ORDER: list shapes FIRST, then arrows. Arrow start/end ids must reference shape ids that already exist in the array.

SHAPES (rectangle, diamond, ellipse):
- type: "rectangle" | "diamond" | "ellipse". Map: rectangle/document/group/mindMap/stickyNote → "rectangle", diamond → "diamond", circle/ellipse → "ellipse".
- id: MUST be "ex-" + node.id (e.g. "ex-node-1").
- x, y: position. Adjust so no shapes overlap; keep 60–100px minimum distance between any two nodes.
- width, height: size the node for its label. Min ~120 width, ~40 height. Longer labels need more width.
- label: { text: string }. Preserve or shorten labels.
- backgroundColor, strokeColor (hex): optional. Use readable colors.

NO OVERLAP (CRITICAL):
- NO two shapes may overlap. Every shape must be completely separate from every other shape.
- If two different nodes would overlap or touch, move them apart so there is clear space between them.
- Check horizontal and vertical: shapes must not share the same x,y region. Each node gets its own non-overlapping bounding box.

DISTANCE BETWEEN NODES:
- Put at least 60–100px horizontal and vertical distance between any two shapes.
- Adjacent nodes in the flow: 80–120px apart. This gives room for arrows and edge labels.
- Never place nodes closer than 50px. Spread overlapping or cramped nodes apart.

SIZING:
- Rectangle nodes: width 120–200, height 40–60 typical.
- Diamonds/ellipses: width and height 80–140 for balance.

ARROWS:
- type: "arrow"
- id: MUST be "ex-e-" + edge.id (e.g. "ex-e-e-1-2").
- start: { id: "ex-<sourceNodeId>" }, end: { id: "ex-<targetNodeId>" } — REQUIRED for connections.
- x, y: approximate midpoint between source and target (for label box). width: 100, height: 24.
- label: { text: "edge label" } — include when the edge has a label (e.g. "yes", "no", "next").
- strokeColor: optional (e.g. "#1971c2").

Use valid JSON only.`;

export function buildDiagramToExcalidrawUserMessage(
  nodes: DiagramInputNode[],
  edges: DiagramInputEdge[]
): string {
  const payload = JSON.stringify({ nodes, edges }, null, 0);
  return `Convert this diagram to Excalidraw skeleton JSON array.

IDs (MUST match exactly):
- Shape id = "ex-" + node.id (e.g. node "abc" → "ex-abc")
- Arrow id = "ex-e-" + edge.id
- Arrow start.id = "ex-" + edge.source, end.id = "ex-" + edge.target — this connects the line to the nodes.

Order: shapes first, then arrows. Ensure NO shapes overlap and keep 60–100px minimum distance between nodes.

Diagram:
${payload}`;
}

export function getDiagramToExcalidrawSystemPrompt(): string {
  return SYSTEM_PROMPT;
}
