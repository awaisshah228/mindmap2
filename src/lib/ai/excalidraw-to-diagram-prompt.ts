/**
 * Prompt for converting Excalidraw elements to React Flow diagram (nodes + edges) via LLM.
 */

export interface ExcalidrawInputElement {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: { text?: string };
  text?: string;
  start?: { id?: string };
  end?: { id?: string };
  startBinding?: { elementId?: string };
  endBinding?: { elementId?: string };
  backgroundColor?: string;
}

const SYSTEM_PROMPT = `You convert an Excalidraw scene (shapes, arrows, text) into a React Flow diagram: nodes and edges.

INPUT: Excalidraw elements array. Types: rectangle, ellipse, diamond, text, arrow, line, freedraw.
- Shapes (rectangle, ellipse, diamond, text): have id, type, x, y, width, height, label.text or text.
- Arrows/lines: have id, type, start.id or startBinding.elementId, end.id or endBinding.elementId, label.text.

OUTPUT: A single JSON object with two arrays: { "nodes": [...], "edges": [...] }

NODES (React Flow format):
- id: string, unique (e.g. "node-1", "node-shapeId"). Map Excalidraw shape ids: "ex-abc" → "abc" or keep unique.
- type: "rectangle" | "diamond" | "circle" | "text" | "stickyNote". Map: rectangle/ellipse/text → "rectangle", diamond → "diamond", ellipse/circle → "circle".
- position: { x: number, y: number } — use element x, y.
- data: { label: string } — from label.text or text.
- width, height: optional; use element width/height if available.

EDGES (React Flow format):
- id: string, unique (e.g. "e-source-target-0").
- source: node id that arrow STARTS from (map Excalidraw start.id / startBinding.elementId to our node id).
- target: node id that arrow ENDS at (map Excalidraw end.id / endBinding.elementId to our node id).
- data: { label?: string } — from arrow label.text when present.

RULES:
1. Map every non-arrow Excalidraw shape to a node. Ignore freedraw unless it looks like a shape.
2. Map every arrow/line that has valid start and end (both pointing to shapes) to an edge.
3. Resolve ids: Excalidraw "ex-node-1" → node id "node-1". Arrow start/end reference shape ids — resolve to our node ids.
4. Preserve layout: use x,y from elements. Ensure no overlaps; nudge if needed.
5. Output ONLY valid JSON. No markdown, no code fences.`;

export function buildExcalidrawToDiagramUserMessage(elements: ExcalidrawInputElement[]): string {
  const normalized = elements.map((e) => ({
    id: e.id,
    type: e.type,
    x: e.x,
    y: e.y,
    width: e.width,
    height: e.height,
    label: e.label?.text ?? e.text,
    start: e.start?.id ?? e.startBinding?.elementId,
    end: e.end?.id ?? e.endBinding?.elementId,
  }));
  return `Convert these Excalidraw elements to React Flow diagram (nodes and edges). Output ONLY a JSON object: { "nodes": [...], "edges": [...] }

Excalidraw elements:
${JSON.stringify(normalized)}`;
}

export function getExcalidrawToDiagramSystemPrompt(): string {
  return SYSTEM_PROMPT;
}
