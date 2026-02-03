import { useCallback, useRef } from "react";
import { timer } from "d3-timer";
import type { Node } from "@xyflow/react";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Applies layout with smooth position animation.
 * Uses d3-timer and lerp for transitions (like React Flow Pro examples).
 */
export function useAnimatedLayout() {
  const timerRef = useRef<ReturnType<typeof timer> | null>(null);

  const applyAnimatedLayout = useCallback(
    (
      targetNodes: Node[],
      setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void,
      startNodes: Node[],
      duration = 600
    ) => {
      if (timerRef.current) timerRef.current.stop();

      if (!targetNodes.length) {
        setNodes(targetNodes);
        return;
      }

      const startMap = new Map(startNodes.map((n) => [n.id, n]));

      timerRef.current = timer((elapsed) => {
        const progress = Math.min(elapsed / duration, 1);

        setNodes((nds) =>
          nds.map((node) => {
            const target = targetNodes.find((n) => n.id === node.id);
            const start = startMap.get(node.id);

            if (!target) return node;
            if (!start?.position || !target.position) {
              return { ...node, ...target };
            }

            return {
              ...node,
              position: {
                x: lerp(start.position.x, target.position.x, progress),
                y: lerp(start.position.y, target.position.y, progress),
              },
              targetPosition: target.targetPosition,
              sourcePosition: target.sourcePosition,
            };
          })
        );

        if (progress >= 1) {
          timerRef.current?.stop();
          setNodes(targetNodes);
        }
      });
    },
    []
  );

  return applyAnimatedLayout;
}
