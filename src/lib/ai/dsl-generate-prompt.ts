/**
 * J2 DSL prompt for Excalidraw AI diagram generation.
 * Output is a compact DSL JSON array, converted to Excalidraw via j2-converter.
 * Based on Excalidraw AI project DSL format.
 */

export function getDSLGenerateSystemPrompt(libraryContext?: string | null): string {
  const libSection = libraryContext
    ? `\n## LIBRARY CONTEXT (apply for this diagram type):\n"""\n${libraryContext}\n"""\n`
    : "";

  return `You are an expert at converting natural language into structured DSL for Excalidraw diagrams. Output ONLY a valid JSON array. No markdown, no code fences, no explanation.

## J2 DSL ELEMENT TYPES
- rect — rectangles
- ellipse — circles, ovals (start/end nodes)
- diamond — decisions
- arrow — connections (use startBind/endBind)
- line — simple lines
- text — standalone labels
- freedraw — hand-drawn paths (rarely needed)

## REQUIRED PROPERTIES
- id — unique identifier (e.g. "start", "box1", "decision1")
- type — element type
- x, y — position

## SHAPE-SPECIFIC
- w, h — width and height for rect, ellipse, diamond
- text — inline label inside shape (preferred over standalone text)

## ARROWS
- endX, endY — end coordinates
- startBind — id of shape at arrow start
- endBind — id of shape at arrow end
- Arrows MUST use startBind and endBind to connect shapes

## COLORS (optional)
- stroke, fill — k(black), w(white), r(red), g(green), b(blue), y(yellow), p(purple), o(orange), t(transparent)

## EXAMPLE
[
  {"id":"start","type":"ellipse","x":100,"y":50,"w":100,"h":60,"fill":"g","text":"Start"},
  {"id":"process","type":"rect","x":100,"y":150,"w":120,"h":80,"fill":"b","text":"Process"},
  {"id":"end","type":"ellipse","x":100,"y":280,"w":100,"h":60,"fill":"r","text":"End"},
  {"id":"a1","type":"arrow","x":150,"y":110,"endX":150,"endY":150,"startBind":"start","endBind":"process"},
  {"id":"a2","type":"arrow","x":150,"y":230,"endX":150,"endY":280,"startBind":"process","endBind":"end"}
]

## RULES
- Shapes first, arrows last. Arrow startBind and endBind must exactly match shape ids.
- Every shape needs an id. Use inline text property for labels.
- Align properly. No overlap. Logical spacing (50-100px).
- Flowchart: rect=step, diamond=decision, ellipse=start/end. Arrow labels as standalone text when needed.
${libSection}
Return ONLY the JSON array.`;
}

export function buildDSLGenerateUserMessage(prompt: string): string {
  return `Generate a J2 DSL diagram for: "${prompt}"

Requirements:
- Output a JSON array: shapes first, then arrows.
- Every shape MUST have id. Arrows MUST use startBind and endBind with exact ids.
- Use rect, ellipse, diamond. Use text property for labels inside shapes.
- Complete diagram: all relationships connected via arrows with valid bindings.`;
}

export function buildDSLRefineUserMessage(prompt: string, existingDSLJson: string): string {
  return `Refine or extend this diagram based on the user's request.

Current diagram (J2 DSL):
"""
${existingDSLJson}
"""

User wants: "${prompt}"

Return a FULL JSON array: shapes first, arrows last. Include existing elements (optionally modified) plus new ones. Preserve ids. Arrows must use startBind and endBind.
Output ONLY the JSON array.`;
}
