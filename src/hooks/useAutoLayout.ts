"use client";

import { useCallback } from "react";
import {
  getLayoutedElements,
  chooseBestLayoutOptions,
  layoutChildrenInsideGroups,
  ensureExtentForGroupedNodes,
  type LayoutDirection,
} from "@/lib/layout-engine";
import { resolveCollisionsWithGroups } from "@/lib/resolve-collisions";
import type { Node, Edge } from "@xyflow/react";

/** Node types excluded from layout (freeform positions). */
const LAYOUT_EXCLUDED_TYPES = new Set(["freeDraw", "edgeAnchor"]);

export interface UseAutoLayoutProps {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  fitView?: () => void;
}

/**
 * Hook for smart auto-layout that chooses the best algorithm based on graph structure.
 * Layouts all layoutable nodes, resolves collisions, and produces a clean flow with no overlaps.
 */
export function useAutoLayout({
  nodes,
  edges,
  setNodes,
  setEdges,
  fitView,
}: UseAutoLayoutProps) {
  const applyAutoLayout = useCallback(
    async (options?: {
      /** If true, only layout selected nodes. Default: false (layout all). */
      selectionOnly?: boolean;
      /** Override direction. If omitted, best direction is auto-selected. */
      direction?: LayoutDirection;
      /** Optional callback when layout completes. */
      onComplete?: () => void;
    }) => {
      const selectionOnly = options?.selectionOnly ?? false;

      const targetNodes = selectionOnly
        ? nodes.filter((n) => n.selected && !LAYOUT_EXCLUDED_TYPES.has(n.type ?? ""))
        : nodes.filter((n) => !LAYOUT_EXCLUDED_TYPES.has(n.type ?? ""));

      const targetIds = new Set(targetNodes.map((n) => n.id));
      const targetEdges = edges.filter(
        (e) => targetIds.has(e.source) && targetIds.has(e.target)
      );

      if (targetNodes.length < 2) {
        options?.onComplete?.();
        return;
      }

      const { algorithm, direction, spacing } = chooseBestLayoutOptions(
        targetNodes,
        targetEdges,
        targetIds
      );

      const resolvedDirection = options?.direction ?? direction;

      try {
        const { nodes: layoutedNodes, edges: layoutedEdges } =
          await getLayoutedElements(
            targetNodes,
            targetEdges,
            resolvedDirection,
            spacing,
            algorithm
          );

        // Layout children inside each group with proper padding and extent
        const withGroupChildren = await layoutChildrenInsideGroups(
          layoutedNodes,
          layoutedEdges,
          resolvedDirection,
          [40, 32]
        );

        const collisionFreeNodes = resolveCollisionsWithGroups(
          ensureExtentForGroupedNodes(withGroupChildren),
          {
            maxIterations: 150,
            overlapThreshold: 0,
            margin: 24,
          }
        );

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
        setTimeout(() => {
          fitView?.();
          options?.onComplete?.();
        }, 50);
      } catch {
        fitView?.();
        options?.onComplete?.();
      }
    },
    [nodes, edges, setNodes, setEdges, fitView]
  );

  const layoutAll = useCallback(() => {
    return applyAutoLayout({ selectionOnly: false });
  }, [applyAutoLayout]);

  const layoutSelection = useCallback(() => {
    return applyAutoLayout({ selectionOnly: true });
  }, [applyAutoLayout]);

  const selectedCount = nodes.filter((n) => n.selected).length;

  return {
    applyAutoLayout,
    layoutAll,
    layoutSelection,
    selectedCount,
  };
}
