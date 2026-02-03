import type { Node, Edge } from "@xyflow/react";

/**
 * Get all descendant node IDs reachable from the given node via outgoing edges.
 */
export function getDescendantIds(nodeId: string, edges: Edge[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const e of edges) {
      if (e.source === current && !result.has(e.target)) {
        result.add(e.target);
        queue.push(e.target);
      }
    }
  }
  return result;
}

/**
 * Get the set of node IDs that should be hidden (descendants of collapsed mind map nodes).
 */
export function getHiddenNodeIds(nodes: Node[], edges: Edge[]): Set<string> {
  const hidden = new Set<string>();
  for (const node of nodes) {
    if (node.type === "mindMap" && (node.data?.collapsed as boolean)) {
      const descendants = getDescendantIds(node.id, edges);
      descendants.forEach((id) => hidden.add(id));
    }
  }
  return hidden;
}

/**
 * Get child count for a mind map node.
 */
export function getChildCount(nodeId: string, edges: Edge[]): number {
  return edges.filter((e) => e.source === nodeId).length;
}
