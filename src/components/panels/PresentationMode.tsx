"use client";

import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  FileText,
  ListOrdered,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { cn } from "@/lib/utils";
import type { Node } from "@xyflow/react";

/* ─── helpers ─── */
const EXCLUDED_TYPES = new Set(["freeDraw", "edgeAnchor"]);
const isPresentable = (n: Node) => !EXCLUDED_TYPES.has(n.type ?? "");
const getNodeLabel = (n: Node) => (n.data?.label as string) || n.type || "Untitled";

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
  const presentationOrder = useCanvasStore((s) => s.presentationOrder);
  const { fitView } = useReactFlow();

  // Build the ordered list of presentable nodes
  const allPresentable = useMemo(
    () => nodes.filter(isPresentable),
    [nodes]
  );

  const presentableNodes = useMemo(() => {
    if (presentationOrder.length === 0) return allPresentable;
    // Use custom order — map IDs to nodes, skip any that no longer exist
    const nodeMap = new Map(allPresentable.map((n) => [n.id, n]));
    const ordered: Node[] = [];
    for (const id of presentationOrder) {
      const n = nodeMap.get(id);
      if (n) ordered.push(n);
    }
    return ordered.length > 0 ? ordered : allPresentable;
  }, [allPresentable, presentationOrder]);

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
            {getNodeLabel(currentNode)}
          </span>
        )}

        <div className="w-px h-6 bg-white/10 mx-1" />

        {/* Slide dots / mini progress */}
        <div className="flex items-center gap-1">
          {presentableNodes.slice(0, 12).map((n, i) => (
            <button
              key={n.id}
              type="button"
              onClick={() => navigateTo(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === presentationNodeIndex
                  ? "bg-violet-400 scale-125"
                  : "bg-gray-600 hover:bg-gray-400"
              )}
              title={getNodeLabel(n)}
            />
          ))}
          {presentableNodes.length > 12 && (
            <span className="text-[10px] text-gray-500 ml-0.5">+{presentableNodes.length - 12}</span>
          )}
        </div>

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
  const setPresentationEditorOpen = useCanvasStore((s) => s.setPresentationEditorOpen);
  const nodes = useCanvasStore((s) => s.nodes);
  const hasNodes = nodes.length > 0;

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => setPresentationMode(true)}
        disabled={!hasNodes}
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Present (P)"
      >
        <Play className="w-4 h-4 text-gray-600" />
      </button>
      <button
        type="button"
        onClick={() => setPresentationEditorOpen(true)}
        disabled={!hasNodes}
        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Edit presentation flow"
      >
        <ListOrdered className="w-4 h-4 text-gray-600" />
      </button>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   Presentation Flow Editor — a panel to reorder the presentation
   sequence by dragging or using up/down arrows.
   ═════════════════════════════════════════════════════════════════ */

export function PresentationFlowEditor() {
  const open = useCanvasStore((s) => s.presentationEditorOpen);
  const setOpen = useCanvasStore((s) => s.setPresentationEditorOpen);
  const nodes = useCanvasStore((s) => s.nodes);
  const presentationOrder = useCanvasStore((s) => s.presentationOrder);
  const setPresentationOrder = useCanvasStore((s) => s.setPresentationOrder);
  const setPresentationMode = useCanvasStore((s) => s.setPresentationMode);

  const allPresentable = useMemo(() => nodes.filter(isPresentable), [nodes]);

  // Local working order (initialised from store or from default)
  const [localOrder, setLocalOrder] = useState<string[]>([]);

  // Sync when panel opens
  useEffect(() => {
    if (!open) return;
    if (presentationOrder.length > 0) {
      // filter out stale IDs
      const valid = new Set(allPresentable.map((n) => n.id));
      setLocalOrder(presentationOrder.filter((id) => valid.has(id)));
    } else {
      setLocalOrder(allPresentable.map((n) => n.id));
    }
  }, [open, presentationOrder, allPresentable]);

  // Node lookup
  const nodeMap = useMemo(() => new Map(allPresentable.map((n) => [n.id, n])), [allPresentable]);

  // IDs not yet in the order
  const unordered = useMemo(() => {
    const set = new Set(localOrder);
    return allPresentable.filter((n) => !set.has(n.id));
  }, [allPresentable, localOrder]);

  /* ── drag state ── */
  const dragIdxRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    dragIdxRef.current = idx;
  };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    const from = dragIdxRef.current;
    if (from == null || from === idx) { setDragOverIdx(null); return; }
    setLocalOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(idx, 0, item);
      return next;
    });
    dragIdxRef.current = null;
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    dragIdxRef.current = null;
    setDragOverIdx(null);
  };

  /* ── reorder helpers ── */
  const moveUp = (idx: number) => {
    if (idx <= 0) return;
    setLocalOrder((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };
  const moveDown = (idx: number) => {
    if (idx >= localOrder.length - 1) return;
    setLocalOrder((prev) => {
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };
  const removeFromOrder = (idx: number) => {
    setLocalOrder((prev) => prev.filter((_, i) => i !== idx));
  };
  const addToOrder = (nodeId: string) => {
    setLocalOrder((prev) => [...prev, nodeId]);
  };
  const resetOrder = () => {
    setLocalOrder(allPresentable.map((n) => n.id));
  };

  const handleSave = () => {
    setPresentationOrder(localOrder);
    setOpen(false);
  };

  const handleSaveAndPresent = () => {
    setPresentationOrder(localOrder);
    setOpen(false);
    setPresentationMode(true);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[440px] max-h-[80vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Presentation Flow</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Description */}
        <div className="px-5 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
          Drag to reorder nodes, or use arrows. This defines the sequence when presenting.
        </div>

        {/* Ordered list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          {localOrder.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No nodes in sequence. Add some below.</p>
          )}
          {localOrder.map((nodeId, idx) => {
            const node = nodeMap.get(nodeId);
            if (!node) return null;
            return (
              <div
                key={nodeId}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className={cn(
                  "flex items-center gap-2 px-2 py-2 rounded-lg mb-1 group cursor-grab active:cursor-grabbing transition-colors",
                  dragOverIdx === idx
                    ? "bg-violet-100 dark:bg-violet-900/40 border border-violet-300 dark:border-violet-600"
                    : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 border border-transparent"
                )}
              >
                {/* Drag handle */}
                <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />

                {/* Index */}
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/60 text-violet-600 dark:text-violet-300 text-[11px] font-bold shrink-0">
                  {idx + 1}
                </span>

                {/* Node type badge */}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider shrink-0">
                  {node.type ?? "node"}
                </span>

                {/* Label */}
                <span className="flex-1 text-sm text-gray-700 dark:text-gray-200 truncate">
                  {getNodeLabel(node)}
                </span>

                {/* Move up / down / remove */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-20 transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(idx)}
                    disabled={idx === localOrder.length - 1}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-20 transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromOrder(idx)}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-400 hover:text-red-600 transition-colors"
                    title="Remove from presentation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Unordered nodes (not in the sequence) */}
        {unordered.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
            <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-1">
              Available nodes ({unordered.length})
            </p>
            <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
              {unordered.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => addToOrder(node.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors group"
                >
                  <Plus className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  <span className="text-[10px] px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-400 uppercase tracking-wider shrink-0">
                    {node.type ?? "node"}
                  </span>
                  <span className="flex-1 text-sm truncate">{getNodeLabel(node)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={resetOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Reset to default order"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleSaveAndPresent}
              disabled={localOrder.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Present
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
