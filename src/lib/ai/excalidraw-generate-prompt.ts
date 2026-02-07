/**
 * Prompt for generating ExcalidrawElementSkeleton (Excalidraw's programmatic API).
 * Output is passed to convertToExcalidrawElements from @excalidraw/excalidraw.
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton
 */

export function getExcalidrawGenerateSystemPrompt(libraryContext?: string | null): string {
  const libSection = libraryContext
    ? `\n## LIBRARY CONTEXT (apply for this diagram type):\n"""\n${libraryContext}\n"""\n`
    : "";

  return `You are an expert at creating clear, professional whiteboard diagrams. Output ONLY a valid JSON array of ExcalidrawElementSkeleton (Excalidraw's programmatic API). No markdown, no code fences, no explanation.

## EXCALIDRAW ELEMENT SKELETON FORMAT (docs.excalidraw.com)
Use the minimum required attributes; the rest are optional.

### Shapes (rectangle, ellipse, diamond)
- Required: type, x, y
- Optional: id (use for arrow bindings), width, height, backgroundColor, strokeColor, strokeWidth, strokeStyle, fillStyle
- Text inside shape: label: { text: "Label" }

### Standalone text
- Required: type: "text", x, y, text: "content"
- Optional: fontSize, strokeColor

### Arrows (bind to shapes)
- Required: type: "arrow", x, y
- Binding: start: { id: "shapeId" }, end: { id: "shapeId" } — ids must match shape ids
- Optional: width, height, label: { text: "Yes" } or { text: "REST" }

### Example
[
  { "type": "rectangle", "id": "a", "x": 100, "y": 100, "width": 120, "height": 60, "label": { "text": "Start" } },
  { "type": "diamond", "id": "b", "x": 280, "y": 100, "width": 100, "height": 80, "label": { "text": "Decision?" } },
  { "type": "arrow", "x": 220, "y": 130, "start": { "id": "a" }, "end": { "id": "b" }, "label": { "text": "Yes" } }
]

## RULES
- Shapes first, arrows last. Arrow start.id and end.id must exactly match shape ids.
- Assign unique id to each shape so arrows can reference them.
- Align properly. Group related shapes. No overlap. Easy to read.
- For flowchart: rectangle=step, diamond=decision, ellipse=start/end. Label arrows Yes/No.
- For architecture: rectangles for services, tiered layout. Arrows with labels (REST, gRPC).

## ORDER & VALIDITY
- Shapes first, then arrows.
- Unique ids on shapes. Valid JSON array only.
${libSection}
Return ONLY the JSON array.`;
}

export function buildExcalidrawGenerateUserMessage(prompt: string): string {
  return `Generate a high-quality whiteboard diagram for: "${prompt}"

Requirements:
- Output a JSON array: shapes first, then arrows.
- Use basic shapes (rectangle, diamond, ellipse) OR complex shapes (type "line" with points for polygons, type "freedraw" for hand-drawn paths).
- Align everything properly. Group related shapes well. Make it easy to read and understand.
- No overlap. Arrows: start.id and end.id must match shape ids. Use exitX/exitY and entryX/entryY for clean connections.
- Use groupIds for related shapes. boundElements + containerId for text inside shapes.
- Complete diagram: all components, every relationship has an arrow. Semantic colors. Arrow labels when helpful (Yes/No, REST, gRPC).`;
}

export function buildExcalidrawRefineUserMessage(prompt: string, existingElementsJson: string): string {
  return `Refine or extend this diagram based on the user's request.

Current diagram (Excalidraw elements):
"""
${existingElementsJson}
"""

User wants: "${prompt}"

Return a FULL JSON array: all shapes first, then all arrows. Include existing elements (optionally modified) plus any new ones. Preserve ids of elements you keep.
Align everything properly. Group well. Easy to read and understand. No overlap. Arrows must use start.id and end.id matching shape ids.
Output ONLY the JSON array.`;
}
