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

function runLayoutAndMerge(
  layoutableNodes: Node[],
  layoutableEdges: Edge[],
  direction: LayoutDirection,
  spacing: [number, number],
  algorithm: string,
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  fitView?: () => void
) {
  return getLayoutedElements(layoutableNodes, layoutableEdges, direction, spacing, algorithm as "elk-layered").then(
    ({ nodes: layoutedNodes, edges: layoutedEdges }) => {
      const collisionFreeNodes = resolveCollisions(layoutedNodes, {
        maxIterations: 150,
        overlapThreshold: 0,
        margin: 24,
      });
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
      setTimeout(() => fitView?.(), 50);
    }
  );
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

      const layoutableNodes = nodes.filter((n) => !LAYOUT_EXCLUDED_TYPES.has(n.type ?? ""));
      const layoutableIds = new Set(layoutableNodes.map((n) => n.id));
      const layoutableEdges = edges.filter(
        (e) => layoutableIds.has(e.source) && layoutableIds.has(e.target)
      );

      try {
        await runLayoutAndMerge(
          layoutableNodes,
          layoutableEdges,
          direction,
          spacing,
          mindMapLayout.algorithm,
          setNodes,
          setEdges,
          fitView
        );
        if (directionOverride) {
          setMindMapLayout({ direction: directionOverride });
        }
      } catch {
        fitView?.();
      }
    },
    [nodes, edges, setNodes, setEdges, mindMapLayout, fitView, setMindMapLayout]
  );

  /** Apply layout only to currently selected nodes (and edges between them). Uses same config as panel. */
  const applyLayoutToSelection = useCallback(async () => {
    const selected = nodes.filter((n) => n.selected);
    const selectedIds = new Set(selected.map((n) => n.id));
    const layoutableSelected = selected.filter((n) => !LAYOUT_EXCLUDED_TYPES.has(n.type ?? ""));
    if (layoutableSelected.length < 2) return;

    const selectedEdges = edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    );
    const direction = mindMapLayout.direction;
    const spacing: [number, number] = [mindMapLayout.spacingX, mindMapLayout.spacingY];

    try {
      await runLayoutAndMerge(
        layoutableSelected,
        selectedEdges,
        direction,
        spacing,
        mindMapLayout.algorithm,
        setNodes,
        setEdges,
        fitView
      );
    } catch {
      fitView?.();
    }
  }, [nodes, edges, setNodes, setEdges, mindMapLayout, fitView]);

  const selectedCount = nodes.filter((n) => n.selected).length;

  return { applyLayout, applyLayoutToSelection, nodes, edges, selectedCount };
}
