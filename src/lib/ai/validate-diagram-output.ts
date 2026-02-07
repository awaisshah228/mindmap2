/**
 * Validates AI-generated diagram output before applying to canvas.
 * Filters invalid nodes/edges and returns sanitized data.
 */

export interface ValidationResult {
  valid: boolean;
  nodes: Record<string, unknown>[];
  edges: Record<string, unknown>[];
  errors: string[];
}

const VALID_NODE_TYPES = new Set([
  "mindMap", "stickyNote", "rectangle", "diamond", "circle", "document", "text",
  "image", "databaseSchema", "service", "queue", "actor", "icon", "group",
]);

export function validateDiagramOutput(
  rawNodes: unknown,
  rawEdges: unknown
): ValidationResult {
  const errors: string[] = [];
  const nodes = Array.isArray(rawNodes) ? rawNodes : [];
  const edges = Array.isArray(rawEdges) ? rawEdges : [];

  const validNodes: Record<string, unknown>[] = [];
  const nodeIds = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i] as Record<string, unknown> | null;
    if (!n || typeof n !== "object") {
      errors.push(`Node ${i}: invalid (not an object)`);
      continue;
    }
    const id = n.id;
    if (typeof id !== "string" || !id.trim()) {
      errors.push(`Node ${i}: missing or invalid id`);
      continue;
    }
    if (nodeIds.has(id)) {
      errors.push(`Node ${i}: duplicate id "${id}"`);
      continue;
    }
    nodeIds.add(id);
    const type = (n.type as string) ?? "rectangle";
    if (!VALID_NODE_TYPES.has(type) && type !== "group") {
      (n as Record<string, unknown>).type = "rectangle";
    }
    validNodes.push(n);
  }

  const validEdges: Record<string, unknown>[] = [];
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i] as Record<string, unknown> | null;
    if (!e || typeof e !== "object") {
      errors.push(`Edge ${i}: invalid (not an object)`);
      continue;
    }
    const source = e.source as string;
    const target = e.target as string;
    if (typeof source !== "string" || typeof target !== "string") {
      errors.push(`Edge ${i}: missing source or target`);
      continue;
    }
    if (!nodeIds.has(source)) {
      errors.push(`Edge ${i}: source "${source}" not in nodes`);
      continue;
    }
    if (!nodeIds.has(target)) {
      errors.push(`Edge ${i}: target "${target}" not in nodes`);
      continue;
    }
    if (source === target) {
      errors.push(`Edge ${i}: self-loop not allowed`);
      continue;
    }
    validEdges.push(e);
  }

  return {
    valid: validNodes.length > 0 && errors.length === 0,
    nodes: validNodes,
    edges: validEdges,
    errors,
  };
}
