/**
 * Prompt for generating Draw.io (diagrams.net) diagrams from user descriptions.
 * Output is a skeleton format that converts to Draw.io mxGraph XML.
 * Separate from Excalidraw/React Flow — optimized for Draw.io conventions.
 * Inspired by https://github.com/DayuanJiang/next-ai-draw-io
 */

const CANVAS_PADDING = 80;
const MIN_H_SPACING = 180;  // Minimum horizontal gap between shapes (px)
const MIN_V_SPACING = 140;  // Minimum vertical gap between shapes (px)

/** Libraries available (matches next-ai-draw-io get_shape_library) */
const SHAPE_LIBRARY_LIST = `- Cloud: aws4, azure2, gcp2, alibaba_cloud, openstack, salesforce
- Networking: cisco19, network, kubernetes, vvd, rack
- Business: bpmn, lean_mapping
- General: flowchart, basic, arrows2, infographic, sitemap
- UI/Mockups: android
- Enterprise: citrix, sap, mscae, atlassian
- Engineering: fluidpower, electrical, pid, cabinets, floorplan
- Icons: webicons`;

const SYSTEM_PROMPT = `You generate Draw.io (diagrams.net) diagrams from user descriptions. Output is converted to Draw.io mxGraph XML. Output ONLY a JSON array. No markdown, no code fences, no explanation.

CANVAS CENTERING (critical): Place the diagram centered in the canvas with padding. Start positions at x=${CANVAS_PADDING}, y=${CANVAS_PADDING} minimum. Leave ${CANVAS_PADDING}px padding from top, bottom, left, right. The canvas size is increased automatically to fit the diagram with padding — so place shapes in a logical layout and the diagram will be centered.

FORMAT — JSON array for Draw.io conversion:
1. VERTICES FIRST: rectangle, diamond, ellipse, text
2. EDGES LAST: arrows (type "arrow") connecting vertices

VERTICES (shapes):
- type: "rectangle" | "diamond" | "ellipse" | "text" | "swimlane" (swimlane = horizontal lane for BPMN/process)
- id: unique string (e.g. "api", "db", "start", "decision1"). Short ids — edges reference these.
- x, y: position in pixels. Start at ${CANVAS_PADDING},${CANVAS_PADDING} or higher. GRID: multiples of 40 (${CANVAS_PADDING}, ${CANVAS_PADDING + 40}, ${CANVAS_PADDING + 80}...).
- width, height: Rectangles 120–160×44–52. Diamonds/ellipses 80–100×80–100. Text: bounding box size.
- label: { text: "..." } — text inside the shape. 2–8 words.
- backgroundColor: hex e.g. "#e7f5ff", "#fff3bf", "#d3f9d8"
- strokeColor: hex e.g. "#1971c2", "#f08c00"
- groupId: (optional) same string for related shapes — clustered visually

EDGES (arrows — Draw.io connection format):
- type: "arrow"
- id: unique e.g. "e1", "arr-api-db"
- start: { id: "<vertexId>" } — MUST match a vertex id from the array
- end: { id: "<vertexId>" } — MUST match a vertex id from the array
- exitX, exitY: where edge LEAVES source (0–1). 1,0.5=right | 0,0.5=left | 0.5,0=top | 0.5,1=bottom
- entryX, entryY: where edge ENTERS target (0–1). Same convention.
- x, y: label position midpoint. width: 100, height: 24.
- label: (optional) { text: "yes" | "no" | "HTTP" } when edge needs a label

DRAW.IO LAYOUT RULES (critical):
1. Canvas padding: Start all shapes at x>=${CANVAS_PADDING}, y>=${CANVAS_PADDING}. Diagram is auto-centered with ${CANVAS_PADDING}px padding on all sides.
2. SPACING: Leave at least ${MIN_H_SPACING}px horizontal and ${MIN_V_SPACING}px vertical BETWEEN shapes. Never place shapes too close — generous spacing looks clean.
3. NO OVERLAP: Shapes must NEVER touch or overlap. Each shape occupies its own space. Leave clear gaps everywhere. Overlapping = rejected.
4. Grid alignment: all x,y in multiples of 40. Align vertices in clear rows/columns.
5. Flow direction: left-to-right (exitX=1→entryX=0) or top-to-bottom (exitY=1→entryY=0). Be consistent.
6. Grouping: related vertices get same groupId — but even grouped shapes need spacing (do not stack on top of each other).

DRAW.IO EDGE RULES (clear connections):
1. ALWAYS set exitX, exitY, entryX, entryY. Draw.io needs these for proper attachment.
2. Flow-based: source right (1,0.5) → target left (0,0.5). Source bottom (0.5,1) → target top (0.5,0).
3. Multiple edges between same pair: offset exitY and entryY — use 0.25, 0.5, 0.75 so edges don't overlap.
4. Avoid crossings: place vertices so edge paths don't cross. Use different sides (top/bottom/left/right).
5. Many connections from one vertex: spread exitX/exitY (0.2, 0.5, 0.8) across sides.

ORDER: All vertices first, then all edges. Edge start.id and end.id must match vertex ids exactly. Unique ids.

AVAILABLE SHAPE LIBRARIES (docs injected when relevant):
${SHAPE_LIBRARY_LIST}
For AWS/cloud diagrams use aws4 conventions. For flowcharts use flowchart. For BPMN use bpmn.

DRAW.IO DIAGRAM TYPES:
- Flowchart: rectangle=process, diamond=decision, ellipse=start/end. Linear flow. Label decision edges (yes/no).
- Architecture: rectangles for components. Group by tier/layer. Edges show data flow.
- UML-style: rectangles for classes/modules. Edges for relationships.
- Process/BPMN: swimlane-style grouping. Sequence of steps.
- Network: nodes and connections. Clear left-to-right or hierarchical layout.
- Mind map: center vertex, branches in rows. Edges from center.

Return ONLY the JSON array.`;

export function getDrawioGenerateSystemPrompt(injectedLibraryDoc?: string): string {
  const libSection = injectedLibraryDoc
    ? `\n\nSHAPE LIBRARY (use these conventions for this diagram):\n"""\n${injectedLibraryDoc}\n"""\n`
    : "";
  return SYSTEM_PROMPT + libSection;
}

export function buildDrawioGenerateUserMessage(prompt: string): string {
  return `Generate a Draw.io diagram for: "${prompt}"

Return a JSON array. Vertices first, then edges.

Draw.io format requirements:
- Canvas centering: Start positions at x=${CANVAS_PADDING}, y=${CANVAS_PADDING} or higher. Diagram is auto-centered with ${CANVAS_PADDING}px padding.
- SPACING: At least ${MIN_H_SPACING}px horizontal and ${MIN_V_SPACING}px vertical between every shape. Never overlap or touch.
- Positions: grid 40px. Each shape must have its own space — no stacking, no crowding.
- Each edge: start: { id }, end: { id }, exitX, exitY, entryX, entryY (0–1).
- exitX=1,exitY=0.5 = right side; entryX=0,entryY=0.5 = left side (for left-to-right flow).
- Multiple edges same pair: offset exitY/entryY (0.25, 0.5, 0.75).
- NO overlapping shapes. Use groupId for related vertices, but keep spacing between them.`;
}
