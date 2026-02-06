import type { Node, Edge } from "@xyflow/react";

/** Chunk size for applying nodes to avoid "Maximum call stack exceeded" with large diagrams (e.g. e-commerce). */
const NODES_CHUNK_SIZE = 35;

/**
 * Apply nodes and edges in chunks so we never pass a huge array to setState at once.
 * Prevents stack overflow when rendering many nodes (e.g. full e-commerce architecture).
 */
export function applyNodesAndEdgesInChunks(
  setNodes: (nodesOrUpdater: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (edgesOrUpdater: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  nodes: Node[],
  edges: Edge[]
): void {
  if (nodes.length <= NODES_CHUNK_SIZE) {
    setNodes(nodes);
    setEdges(edges);
    return;
  }
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
    }
  }
  requestAnimationFrame(scheduleNext);
}
