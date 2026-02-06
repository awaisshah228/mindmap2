import type { Node, Edge } from "@xyflow/react";

/** Chunk size for applying nodes on load — keeps UI responsive and allows progressive rendering before auto-layout. */
const NODES_CHUNK_SIZE = 25;

/**
 * Sort nodes so parents come before children. Required for React Flow's clampPositionToParent
 * to avoid "Cannot read properties of undefined (reading 'measured')" when loading.
 */
function sortParentsBeforeChildren(nodes: Node[]): Node[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const added = new Set<string>();
  const result: Node[] = [];
  let changed = true;
  while (changed && result.length < nodes.length) {
    changed = false;
    for (const n of nodes) {
      if (added.has(n.id)) continue;
      const parentId = n.parentId;
      if (!parentId || added.has(parentId) || !byId.has(parentId)) {
        result.push(n);
        added.add(n.id);
        changed = true;
      }
    }
  }
  for (const n of nodes) {
    if (!added.has(n.id)) result.push(n);
    added.add(n.id);
  }
  return result;
}

/**
 * Apply nodes and edges in chunks so we never pass a huge array to setState at once.
 * Always chunks (even for small projects) so nodes render progressively on load before auto-layout runs.
 * Parents are ordered before children to avoid React Flow clampPositionToParent crashes.
 * Returns a Promise that resolves when all chunks have been applied.
 */
export function applyNodesAndEdgesInChunks(
  setNodes: (nodesOrUpdater: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (edgesOrUpdater: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  nodes: Node[],
  edges: Edge[]
): Promise<void> {
  const ordered = sortParentsBeforeChildren(nodes);
  if (ordered.length === 0) {
    setNodes([]);
    setEdges(edges);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let index = 0;
    function scheduleNext() {
      const chunk = ordered.slice(index, index + NODES_CHUNK_SIZE);
      index += NODES_CHUNK_SIZE;
      if (index <= NODES_CHUNK_SIZE) {
        setNodes(chunk);
      } else {
        setNodes((prev) => [...prev, ...chunk]);
      }
      if (index < ordered.length) {
        requestAnimationFrame(scheduleNext);
      } else {
        setEdges(edges);
        resolve();
      }
    }
    requestAnimationFrame(scheduleNext);
  });
}
