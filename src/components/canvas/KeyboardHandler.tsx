"use client";

import { useCallback, useEffect } from "react";
import { useCopyPaste } from "@/hooks/useCopyPaste";
import type { Node, Edge } from "@xyflow/react";

interface KeyboardHandlerProps {
  getNodes: () => Node[];
  getEdges: () => Edge[];
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  pushUndo?: () => void;
  undo?: () => void;
  redo?: () => void;
}

export function KeyboardHandler({
  getNodes,
  getEdges,
  setNodes,
  setEdges,
  screenToFlowPosition,
  pushUndo,
  undo,
  redo,
}: KeyboardHandlerProps) {
  const { copy, paste, deleteSelected } = useCopyPaste(
    getNodes,
    getEdges,
    setNodes,
    setEdges,
    screenToFlowPosition
  );

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })));
  }, [setNodes, setEdges]);

  const deselectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
  }, [setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable;
      const isUndoRedo = (e.metaKey || e.ctrlKey) && !inInput;

      if (e.key === "a" && (e.metaKey || e.ctrlKey) && !inInput) {
        e.preventDefault();
        if (e.shiftKey) {
          deselectAll();
        } else {
          selectAll();
        }
      } else if (e.key === "c" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        copy();
      } else if (e.key === "v" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        paste();
      } else if (isUndoRedo && (e.key === "z" || e.key === "Z" || e.keyCode === 90)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          redo?.();
        } else {
          undo?.();
        }
      } else if (isUndoRedo && (e.key === "y" || e.key === "Y" || e.keyCode === 89)) {
        e.preventDefault();
        e.stopPropagation();
        redo?.();
      } else if (e.key === "Escape") {
        if (!inInput) deselectAll();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (!inInput) {
          e.preventDefault();
          pushUndo?.();
          deleteSelected();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [copy, paste, deleteSelected, pushUndo, undo, redo, selectAll, deselectAll]);

  return null;
}
