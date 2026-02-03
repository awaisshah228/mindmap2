import { useCallback } from "react";
import { useStore } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { getLayoutedElements, type LayoutDirection } from "@/lib/layout-engine";
import { resolveCollisions } from "@/lib/resolve-collisions";
import type { Node, Edge } from "@xyflow/react";

interface UseApplyMindMapLayoutProps {
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  fitView?: () => void;
}

export function useApplyMindMapLayout({
  setNodes,
  setEdges,
  fitView,
}: UseApplyMindMapLayoutProps) {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const mindMapLayout = useCanvasStore((s) => s.mindMapLayout);
  const setMindMapLayout = useCanvasStore((s) => s.setMindMapLayout);

  const applyLayout = useCallback(
    async (directionOverride?: LayoutDirection) => {
      const direction = directionOverride ?? mindMapLayout.direction;
      const spacing: [number, number] = [mindMapLayout.spacingX, mindMapLayout.spacingY];
      try {
        const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
          nodes,
          edges,
          direction,
          spacing,
          mindMapLayout.algorithm
        );
        setEdges(layoutedEdges);
        const collisionFreeNodes = resolveCollisions(layoutedNodes, {
          maxIterations: 150,
          overlapThreshold: 0,
          margin: 24,
        });
        setNodes(collisionFreeNodes);
        // Sync direction to store only after edges/nodes are updated, so MindMapNode never
        // renders new handles before edges have the matching handle IDs (fixes edges disappearing with Dagre).
        if (directionOverride) {
          setMindMapLayout({ direction: directionOverride });
        }
        setTimeout(() => {
          fitView?.();
        }, 50);
      } catch {
        fitView?.();
      }
    },
    [nodes, edges, setNodes, setEdges, mindMapLayout, fitView, setMindMapLayout]
  );

  return { applyLayout, nodes, edges };
}
