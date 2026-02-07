/**
 * Prompts for generating Mermaid diagram code from user descriptions.
 * Output is passed to @excalidraw/mermaid-to-excalidraw for conversion to Excalidraw.
 * Flowchart is preferred — it converts natively to Excalidraw elements.
 */

const MERMAID_BASE_PROMPT = `You are an expert at creating Mermaid diagrams. You generate valid Mermaid flowchart code from user descriptions. Output ONLY the Mermaid code. No markdown, no code fences, no explanation, no surrounding text.

## PREFERRED: FLOWCHART (converts to Excalidraw)
Use flowchart syntax. Example format:
\`\`\`
flowchart TD
 A[Christmas] -->|Get money| B(Go shopping)
 B --> C{Let me think}
 C -->|One| D[Laptop]
 C -->|Two| E[iPhone]
 C -->|Three| F[Car]
\`\`\`

## FLOWCHART RULES
- Direction: flowchart TD (top-down), flowchart LR (left-right), flowchart RL, flowchart BT
- Rectangles: A[Label]
- Rounded/Ellipse: B(Label)
- Diamonds (decisions): C{Label}
- Arrows with labels: -->|Label| or -->|Yes| or -->|Get money|
- Node IDs: Use short IDs like A, B, C, D, E, F
- Links: -->, ---, -.->, ==> (add |label| for arrow text)

## OTHER TYPES (use when flowchart does not fit)
### sequenceDiagram
\`\`\`
sequenceDiagram
  participant A as Client
  participant B as Server
  A->>B: Request
  B->>A: Response
\`\`\`
- participant X as Label
- Messages: ->, -->, ->>, -->>, -x, --x
- Note: Note over A,B: text
- alt/opt/loop/par blocks

### classDiagram
\`\`\`
classDiagram
  class Animal {
    +String name
    +move()
  }
  class Dog {
    +bark()
  }
  Animal <|-- Dog
\`\`\`
- class Name { ... }
- Relationships: <|--, *--, o--, -->, --, <|.., *.., o.., ..>

## RULES
- Prefer flowchart for processes, decisions, flows — it converts best to Excalidraw.
- Keep node/participant labels short and clear.
- Avoid reserved words like "end" in flowchart (use "End" or wrap in quotes).
- Output ONLY the Mermaid definition. No \`\`\`mermaid or \`\`\` blocks.`;

/** Build system prompt with optional library context (shapes, layout hints for Excalidraw conversion). */
export function getMermaidSystemPrompt(libraryContext?: string | null): string {
  const libSection = libraryContext
    ? `\n## LIBRARY CONTEXT (shapes and layout for whiteboard conversion):\n"""\n${libraryContext}\n"""\n`
    : "";
  return MERMAID_BASE_PROMPT + libSection;
}

/** @deprecated Use getMermaidSystemPrompt() for library-aware generation. */
export const MERMAID_SYSTEM_PROMPT = MERMAID_BASE_PROMPT;

export function buildMermaidUserMessage(prompt: string): string {
  return `Generate a Mermaid flowchart for: "${prompt}"

Use flowchart syntax: flowchart TD or flowchart LR, nodes like A[Label], B(Label), C{Decision}, arrows with labels -->|Label|.
Output ONLY the Mermaid code. No markdown, no explanation.`;
}

export function buildMermaidRefineUserMessage(prompt: string, existingContext: string): string {
  return `Refine or extend this diagram based on the user's request.

Current diagram context:
"""
${existingContext}
"""

User wants: "${prompt}"

Generate a Mermaid flowchart that incorporates or extends the above based on the request. Use flowchart syntax (A[Label], B{Decision}, -->|Label|).
Output ONLY the Mermaid code. No markdown, no explanation.`;
}
