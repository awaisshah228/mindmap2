"use client";

import { useEffect, useCallback, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  FileText,
} from "lucide-react";
import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * Presentation controls rendered inside <ReactFlow> (DiagramCanvas).
 * NO overlay — the canvas background is set to white by DiagramCanvas when
 * presentationMode is active. Nodes, edges, and the canvas remain fully
 * visible and clickable so users can inspect notes/progress.
 */
export function PresentationMode() {
  const presentationMode = useCanvasStore((s) => s.presentationMode);
  const setPresentationMode = useCanvasStore((s) => s.setPresentationMode);
  const presentationNodeIndex = useCanvasStore((s) => s.presentationNodeIndex);
  const setPresentationNodeIndex = useCanvasStore(
    (s) => s.setPresentationNodeIndex
  );
  const nodes = useCanvasStore((s) => s.nodes);
  const setDetailsPanelNodeId = useCanvasStore(
    (s) => s.setDetailsPanelNodeId
  );
  const { fitView } = useReactFlow();

  // Filter to meaningful nodes (skip freeDraw, edgeAnchor, group)
  const presentableNodes = useMemo(
    () =>
      nodes.filter(
        (n) =>
          n.type !== "freeDraw" &&
          n.type !== "edgeAnchor" &&
          n.type !== "group"
      ),
    [nodes]
  );

  const currentNode = presentableNodes[presentationNodeIndex];

  const navigateTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= presentableNodes.length) return;
      setPresentationNodeIndex(index);
      const node = presentableNodes[index];
      if (!node) return;

      // Zoom into the single target node
      fitView({
        nodes: [{ id: node.id }],
        duration: 400,
        padding: 0.4,
        maxZoom: 1.5,
      });
    },
    [presentableNodes, setPresentationNodeIndex, fitView]
  );

  // On entering presentation mode, navigate to the first (or currently selected) node
  useEffect(() => {
    if (!presentationMode || presentableNodes.length === 0) return;

    const selectedIdx = presentableNodes.findIndex((n) => n.selected);
    const startIdx = selectedIdx >= 0 ? selectedIdx : 0;
    setPresentationNodeIndex(startIdx);

    // Small delay so React Flow viewport is ready
    const timer = setTimeout(() => {
      const node = presentableNodes[startIdx];
      if (node) {
        fitView({
          nodes: [{ id: node.id }],
          duration: 500,
          padding: 0.4,
          maxZoom: 1.5,
        });
      }
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentationMode]);

  // Keyboard navigation (arrow keys + escape)
  useEffect(() => {
    if (!presentationMode) return;

    const handleKey = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable;
      if (inInput) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        navigateTo(presentationNodeIndex + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        navigateTo(presentationNodeIndex - 1);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setPresentationMode(false);
      }
    };

    window.addEventListener("keydown", handleKey, true);
    return () => window.removeEventListener("keydown", handleKey, true);
  }, [presentationMode, presentationNodeIndex, navigateTo, setPresentationMode]);

  if (!presentationMode) return null;

  return (
    /* Bottom navigation controls — no overlay, just the nav bar */
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3"
      style={{ zIndex: 9999 }}
    >
      <div className="flex items-center gap-2 bg-gray-900/95 backdrop-blur-md text-white rounded-2xl px-5 py-3 shadow-2xl border border-white/10">
        {/* Previous */}
        <button
          type="button"
          onClick={() => navigateTo(presentationNodeIndex - 1)}
          disabled={presentationNodeIndex <= 0}
          className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Previous (←)"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Counter */}
        <div className="flex items-center gap-1.5 px-3 min-w-[80px] justify-center">
          <span className="text-lg font-bold tabular-nums">
            {presentationNodeIndex + 1}
          </span>
          <span className="text-gray-500 text-sm">/</span>
          <span className="text-sm text-gray-400 tabular-nums">
            {presentableNodes.length}
          </span>
        </div>

        {/* Next */}
        <button
          type="button"
          onClick={() => navigateTo(presentationNodeIndex + 1)}
          disabled={presentationNodeIndex >= presentableNodes.length - 1}
          className="p-2 rounded-xl hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          title="Next (→)"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Current node label */}
        {currentNode && (
          <span className="text-sm text-gray-300 max-w-[220px] truncate font-medium">
            {(currentNode.data?.label as string) || "Untitled"}
          </span>
        )}

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* View notes button */}
        {currentNode && (
          <button
            type="button"
            onClick={() => setDetailsPanelNodeId(currentNode.id)}
            className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            title="View notes & tasks (Shift+E)"
          >
            <FileText className="w-4 h-4" />
          </button>
        )}

        {/* Exit */}
        <button
          type="button"
          onClick={() => setPresentationMode(false)}
          className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="Exit presentation (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

/** Button to toggle presentation mode (used in the top bar — outside ReactFlow) */
export function PresentationModeButton() {
  const setPresentationMode = useCanvasStore((s) => s.setPresentationMode);
  const nodes = useCanvasStore((s) => s.nodes);
  const hasNodes = nodes.length > 0;

  return (
    <button
      type="button"
      onClick={() => setPresentationMode(true)}
      disabled={!hasNodes}
      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      title="Present (P)"
    >
      <Play className="w-4 h-4 text-gray-600" />
    </button>
  );
}
