import type { Node, Edge } from "@xyflow/react";

/** Chunk size for applying nodes on load — keeps UI responsive and allows progressive rendering before auto-layout. */
const NODES_CHUNK_SIZE = 25;

/**
 * Apply nodes and edges in chunks so we never pass a huge array to setState at once.
 * Always chunks (even for small projects) so nodes render progressively on load before auto-layout runs.
 * Returns a Promise that resolves when all chunks have been applied.
 */
export function applyNodesAndEdgesInChunks(
  setNodes: (nodesOrUpdater: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (edgesOrUpdater: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  nodes: Node[],
  edges: Edge[]
): Promise<void> {
  if (nodes.length === 0) {
    setNodes([]);
    setEdges(edges);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let index = 0;
    function scheduleNext() {
      const chunk = nodes.slice(index, index + NODES_CHUNK_SIZE);
      index += NODES_CHUNK_SIZE;
      if (index <= NODES_CHUNK_SIZE) {
        setNodes(chunk);
      } else {
        setNodes((prev) => [...prev, ...chunk]);
      }
      if (index < nodes.length) {
        requestAnimationFrame(scheduleNext);
      } else {
        setEdges(edges);
        resolve();
      }
    }
    requestAnimationFrame(scheduleNext);
  });
}
