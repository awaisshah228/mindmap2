/**
 * Incremental parser for streaming diagram JSON.
 * Extracts complete node and edge objects from an accumulating buffer
 * so we can render them as they stream instead of waiting for the full response.
 */

export interface StreamingParseResult {
  /** All nodes parsed so far from the buffer (cumulative). */
  nodes: Record<string, unknown>[];
  /** All edges parsed so far from the buffer (cumulative). */
  edges: Record<string, unknown>[];
  phase: "nodes" | "edges" | "before" | "done";
}

/**
 * Find the index of the next complete JSON object starting at startIndex.
 * Uses brace matching; respects strings (double-quoted). Returns the end index (exclusive)
 * of the object, or -1 if no complete object found.
 */
function findCompleteObject(buffer: string, startIndex: number): number {
  const i = buffer.indexOf("{", startIndex);
  if (i === -1) return -1;

  let depth = 0;
  let inString = false;
  let escape = false;
  let j = i;

  while (j < buffer.length) {
    const c = buffer[j];

    if (escape) {
      escape = false;
      j++;
      continue;
    }
    if (inString) {
      if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      j++;
      continue;
    }
    if (c === '"') {
      inString = true;
      j++;
      continue;
    }
    if (c === "{") {
      depth++;
      j++;
      continue;
    }
    if (c === "}") {
      depth--;
      j++;
      if (depth === 0) return j;
      continue;
    }
    j++;
  }
  return -1;
}

/**
 * Advance past whitespace and optional comma; return the new start index.
 */
function skipWhitespaceAndComma(buffer: string, start: number): number {
  while (start < buffer.length) {
    const c = buffer[start];
    if (c === " " || c === "\n" || c === "\r" || c === "\t" || c === ",") start++;
    else break;
  }
  return start;
}

/**
 * Parse as much as we can from the buffer: extract complete node and edge objects.
 * Call this each time new chunk data is appended. Returns parsed items and how many
 * characters were consumed (so caller can trim buffer or track position).
 */
export function parseStreamingDiagramBuffer(buffer: string): StreamingParseResult {
  const nodes: Record<string, unknown>[] = [];
  const edges: Record<string, unknown>[] = [];
  let phase: "nodes" | "edges" | "before" | "done" = "before";

  const nodesKey = '"nodes"';
  const edgesKey = '"edges"';
  const nodesArrayStart = buffer.indexOf(nodesKey);
  if (nodesArrayStart === -1) return { nodes: [], edges: [], phase: "before" };

  const afterNodesKey = nodesArrayStart + nodesKey.length;
  const bracketStart = buffer.indexOf("[", afterNodesKey);
  if (bracketStart === -1 || bracketStart > afterNodesKey + 2) return { nodes: [], edges: [], phase: "before" };

  let pos = bracketStart + 1;
  phase = "nodes";

  // Extract node objects until we hit ]
  while (pos < buffer.length) {
    pos = skipWhitespaceAndComma(buffer, pos);
    if (pos >= buffer.length) break;
    if (buffer[pos] === "]") {
      pos = pos + 1;
      const edgesStart = buffer.indexOf(edgesKey, pos);
      if (edgesStart === -1) {
        phase = "done";
        break;
      }
      const edgesBracket = buffer.indexOf("[", edgesStart + edgesKey.length);
      if (edgesBracket === -1) {
        phase = "done";
        break;
      }
      pos = edgesBracket + 1;
      phase = "edges";
      continue;
    }
    const end = findCompleteObject(buffer, pos);
    if (end === -1) break;
    const slice = buffer.slice(pos, end);
    try {
      const obj = JSON.parse(slice) as Record<string, unknown>;
      if (phase === "nodes" && obj && typeof obj === "object" && "id" in obj) {
        nodes.push(obj);
      } else if (phase === "edges" && obj && typeof obj === "object" && "source" in obj && "target" in obj) {
        edges.push(obj);
      }
    } catch {
      // skip malformed object
    }
    pos = end;
  }

  return { nodes, edges, phase };
}

/** Result for parsing streaming elements array (Draw.io / Excalidraw skeleton format). */
export interface StreamingElementsParseResult {
  elements: Record<string, unknown>[];
  done: boolean;
}

/**
 * Parse a streaming JSON array of elements (e.g. [ {...}, {...} ]).
 * Extracts complete objects as they stream in.
 * Handles both raw array [ {...} ] and wrapped { "elements": [ {...} ] }.
 */
export function parseStreamingElementsBuffer(buffer: string): StreamingElementsParseResult {
  const elements: Record<string, unknown>[] = [];
  const trimmed = buffer.trim();

  // Try wrapped format first: { "elements": [ ... ] }
  const elementsKey = '"elements"';
  const elementsIdx = trimmed.indexOf(elementsKey);
  if (elementsIdx !== -1) {
    const bracketStart = trimmed.indexOf("[", elementsIdx + elementsKey.length);
    if (bracketStart === -1) return { elements: [], done: false };
    let pos = bracketStart + 1;
    while (pos < trimmed.length) {
      pos = skipWhitespaceAndComma(trimmed, pos);
      if (pos >= trimmed.length) break;
      if (trimmed[pos] === "]") return { elements, done: true };
      const end = findCompleteObject(trimmed, pos);
      if (end === -1) break;
      try {
        const obj = JSON.parse(trimmed.slice(pos, end)) as Record<string, unknown>;
        if (obj && typeof obj === "object" && "type" in obj) elements.push(obj);
      } catch {
        /* skip */
      }
      pos = end;
    }
    return { elements, done: false };
  }

  // Raw array: [ {...}, {...} ]
  const arrayStart = trimmed.indexOf("[");
  if (arrayStart === -1) return { elements: [], done: false };
  let pos = arrayStart + 1;
  while (pos < trimmed.length) {
    pos = skipWhitespaceAndComma(trimmed, pos);
    if (pos >= trimmed.length) break;
    if (trimmed[pos] === "]") return { elements, done: true };
    const end = findCompleteObject(trimmed, pos);
    if (end === -1) break;
    try {
      const obj = JSON.parse(trimmed.slice(pos, end)) as Record<string, unknown>;
      if (obj && typeof obj === "object" && "type" in obj) elements.push(obj);
    } catch {
      /* skip */
    }
    pos = end;
  }
  return { elements, done: false };
}
