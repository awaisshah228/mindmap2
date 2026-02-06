"use client";

import { useState, useEffect, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import { MessageSquare, Loader2, RotateCcw, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { applyNodesAndEdgesInChunks } from "@/lib/chunked-nodes";
import { isApiProjectId } from "@/lib/store/project-storage";
import { cn } from "@/lib/utils";

export type PromptHistoryItem = {
  id: string;
  prompt: string;
  nodes: object[];
  edges: object[];
  targetCanvas?: string;
  nodeCount?: number;
  edgeCount?: number;
  createdAt?: number;
};

interface PromptHistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function PromptHistoryPanel({ open, onOpenChange }: PromptHistoryPanelProps) {
  const activeProjectId = useCanvasStore((s) => s.activeProjectId);
  const persistenceSource = useCanvasStore((s) => s.persistenceSource);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setCanvasMode = useCanvasStore((s) => s.setCanvasMode);
  const setPendingFitView = useCanvasStore((s) => (s as { setPendingFitView: (v: boolean) => void }).setPendingFitView);
  const setPendingFitViewNodeIds = useCanvasStore((s) => (s as { setPendingFitViewNodeIds: (ids: string[] | null) => void }).setPendingFitViewNodeIds);
  const setHasUnsavedChanges = useCanvasStore((s) => s.setHasUnsavedChanges);

  const [items, setItems] = useState<PromptHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isApiProject = Boolean(
    activeProjectId && isApiProjectId(activeProjectId) && persistenceSource === "cloud"
  );

  const fetchHistory = useCallback(async () => {
    if (!activeProjectId || !isApiProjectId(activeProjectId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/prompt-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (open && isApiProject) fetchHistory();
  }, [open, isApiProject, fetchHistory]);

  const handleRestore = useCallback(
    (item: PromptHistoryItem) => {
      const nodes = item.nodes as Node[];
      const edges = item.edges as Edge[];
      if (!Array.isArray(nodes) || nodes.length === 0) return;
      setCanvasMode("reactflow");
      applyNodesAndEdgesInChunks(setNodes, setEdges, nodes, edges);
      setPendingFitView(true);
      setPendingFitViewNodeIds(nodes.map((n) => n.id));
      setHasUnsavedChanges(true);
      onOpenChange(false);
    },
    [setNodes, setEdges, setCanvasMode, setPendingFitView, setPendingFitViewNodeIds, setHasUnsavedChanges, onOpenChange]
  );

  const hasRestorableDiagram = (item: PromptHistoryItem) => {
    const nodes = item.nodes;
    return Array.isArray(nodes) && nodes.length > 0 && item.targetCanvas === "reactflow";
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-xl bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700",
            "max-h-[80vh] flex flex-col"
          )}
          onPointerDownOutside={() => onOpenChange(false)}
          onEscapeKeyDown={() => onOpenChange(false)}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Prompt history
            </h2>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {!isApiProject ? (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
              Open a cloud-saved project to see prompt history.
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
              No prompts yet. Generate a diagram with AI to see history.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <p className="text-sm text-gray-900 dark:text-white line-clamp-2">{item.prompt}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {item.nodeCount ?? 0} nodes · {item.edgeCount ?? 0} edges
                      {item.targetCanvas && item.targetCanvas !== "reactflow" && (
                        <span className="ml-1">· {item.targetCanvas}</span>
                      )}
                      {item.createdAt && (
                        <span className="ml-1">· {timeAgo(item.createdAt)}</span>
                      )}
                    </span>
                    {hasRestorableDiagram(item) && (
                      <button
                        type="button"
                        onClick={() => handleRestore(item)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                      >
                        <RotateCcw className="w-3 h-3" />
                        View diagram
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
