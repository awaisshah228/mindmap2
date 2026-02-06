"use client";

import { useCallback, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";

export function useCopyPaste(
  getNodes: () => Node[],
  getEdges: () => Edge[],
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number }
) {
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);

  const copy = useCallback(() => {
    const nodes = getNodes();
    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) return;

    const minX = Math.min(...selectedNodes.map((n) => n.position.x));
    const minY = Math.min(...selectedNodes.map((n) => n.position.y));

    clipboardRef.current = {
      nodes: selectedNodes.map((n) => ({
        ...n,
        id: `${n.id}-copy-${Date.now()}`,
        position: {
          x: n.position.x - minX + 50,
          y: n.position.y - minY + 50,
        },
        selected: false,
      })),
      edges: getEdges().filter(
        (e) =>
          selectedNodes.some((n) => n.id === e.source) &&
          selectedNodes.some((n) => n.id === e.target)
      ),
    };
  }, [getNodes, getEdges]);

  const paste = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard?.nodes.length) return;
      pushUndo();

      const center = screenToFlowPosition({
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
        y: typeof window !== "undefined" ? window.innerHeight / 2 - 100 : 300,
      });

      const idMap = new Map<string, string>();
      clipboard.nodes.forEach((n, i) => {
        const newId = `node-${Date.now()}-${i}`;
        idMap.set(n.id, newId);
      });

      const newNodes = clipboard.nodes.map((n) => ({
        ...n,
        id: idMap.get(n.id) ?? n.id,
        position: {
          x: center.x + n.position.x - 75,
          y: center.y + n.position.y - 25,
        },
        selected: false,
      }));

      const ts = Date.now();
      const newEdges = clipboard.edges
        .map((e, i) => {
          const newSource = idMap.get(e.source);
          const newTarget = idMap.get(e.target);
          if (newSource && newTarget) {
            return {
              ...e,
              id: `e${newSource}-${e.sourceHandle ?? "s"}-${newTarget}-${e.targetHandle ?? "t"}-${ts}-${i}`,
              source: newSource,
              target: newTarget,
            };
          }
          return null;
        })
        .filter(Boolean) as Edge[];

      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
    },
    [screenToFlowPosition, setNodes, setEdges, pushUndo]
  );

  const canPaste = () => !!clipboardRef.current?.nodes.length;

  const deleteSelected = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
    if (selectedIds.length === 0) return;

    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) =>
      eds.filter(
        (e) => !selectedIds.includes(e.source) && !selectedIds.includes(e.target)
      )
    );
  }, [getNodes, getEdges, setNodes, setEdges]);

  return { copy, paste, deleteSelected, canPaste };
}
