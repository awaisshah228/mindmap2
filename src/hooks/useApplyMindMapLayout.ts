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

/** Node types that must never be repositioned by layout algorithms. */
const LAYOUT_EXCLUDED_TYPES = new Set(["freeDraw", "edgeAnchor", "group"]);

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

      // Filter out freehand / anchor / group nodes — they keep their positions
      const layoutableNodes = nodes.filter((n) => !LAYOUT_EXCLUDED_TYPES.has(n.type ?? ""));
      const layoutableIds = new Set(layoutableNodes.map((n) => n.id));
      const layoutableEdges = edges.filter(
        (e) => layoutableIds.has(e.source) && layoutableIds.has(e.target)
      );

      try {
        const { nodes: layoutedNodes, edges: layoutedEdges } = await getLayoutedElements(
          layoutableNodes,
          layoutableEdges,
          direction,
          spacing,
          mindMapLayout.algorithm
        );

        const collisionFreeNodes = resolveCollisions(layoutedNodes, {
          maxIterations: 150,
          overlapThreshold: 0,
          margin: 24,
        });

        // Merge back — only update layouted nodes/edges, leave freehand untouched
        setNodes((all) =>
          all.map((n) => {
            const ln = collisionFreeNodes.find((x) => x.id === n.id);
            return ln ? { ...n, position: ln.position } : n;
          })
        );
        setEdges((all) =>
          all.map((e) => {
            const le = layoutedEdges.find((x) => x.id === e.id);
            return le
              ? {
                  ...e,
                  sourceHandle: le.sourceHandle ?? e.sourceHandle,
                  targetHandle: le.targetHandle ?? e.targetHandle,
                }
              : e;
          })
        );

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
