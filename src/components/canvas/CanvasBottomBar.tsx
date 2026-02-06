"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Panel, useReactFlow, useStore } from "@xyflow/react";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Save,
  Check,
  Circle,
  LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { saveNow } from "@/lib/store/project-storage";

interface CanvasBottomBarProps {
  selectedNodeCount: number;
  onLayoutSelection: () => void;
  onLayoutAll: () => void;
}

/** Format a relative time string like "just now", "5s ago", "2m ago" */
function timeAgo(ts: number | null): string {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function CanvasBottomBarInner({
  selectedNodeCount,
  onLayoutSelection,
  onLayoutAll,
}: CanvasBottomBarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const undoStack = useCanvasStore((s) => s.undoStack);
  const redoStack = useCanvasStore((s) => s.redoStack);
  const lastSavedAt = useCanvasStore((s) => s.lastSavedAt);
  const hasUnsavedChanges = useCanvasStore((s) => s.hasUnsavedChanges);
  const showSaveLayoutLabel = useCanvasStore((s) => s.showSaveLayoutLabel);
  const setShowSaveLayoutLabel = useCanvasStore((s) => s.setShowSaveLayoutLabel);
  const applyLayoutAtStart = useCanvasStore((s) => s.applyLayoutAtStart);
  const setApplyLayoutAtStart = useCanvasStore((s) => s.setApplyLayoutAtStart);

  // Update relative time display periodically
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = useCallback(() => {
    saveNow();
    setShowSaveLayoutLabel(false);
  }, [setShowSaveLayoutLabel]);

  // Listen for Ctrl+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveNow();
        useCanvasStore.getState().setShowSaveLayoutLabel(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const zoomPercent = `${Math.round(zoom * 100)}%`;

  return (
    <Panel position="bottom-center" className="!mb-3">
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 px-2 py-1.5">
        {/* Save status */}
        <div className="flex items-center gap-1.5 px-2 min-w-[100px]">
          {hasUnsavedChanges ? (
            <>
              <Circle className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Unsaved</span>
            </>
          ) : lastSavedAt ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[11px] text-gray-500 dark:text-gray-400">Saved {timeAgo(lastSavedAt)}</span>
            </>
          ) : (
            <span className="text-[11px] text-gray-400">Not saved</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          className={cn(
            "p-1.5 rounded-lg transition-colors flex items-center gap-1",
            hasUnsavedChanges
              ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50"
              : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
          title={showSaveLayoutLabel ? "Save positions (Ctrl/Cmd+S)" : "Save (Ctrl/Cmd+S)"}
        >
          <Save className="w-4 h-4 shrink-0" />
          {showSaveLayoutLabel && <span className="text-[11px] font-medium whitespace-nowrap">Save layout</span>}
        </button>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />

        {/* Layout buttons */}
        <button
          type="button"
          onClick={() => {
            onLayoutSelection();
            setShowSaveLayoutLabel(true);
            window.setTimeout(() => setShowSaveLayoutLabel(false), 8000);
          }}
          className="text-[11px] px-2 py-1 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          disabled={selectedNodeCount < 2}
          title="Layout selected nodes"
        >
          Layout selection
        </button>
        <button
          type="button"
          onClick={() => {
            onLayoutAll();
            setShowSaveLayoutLabel(true);
            window.setTimeout(() => setShowSaveLayoutLabel(false), 8000);
          }}
          className="text-[11px] px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium"
          title="Auto-layout all nodes"
        >
          Layout all
        </button>

        <label
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-[11px] text-gray-600 dark:text-gray-400"
          title="Apply saved layout when opening a project"
        >
          <input
            type="checkbox"
            checked={applyLayoutAtStart}
            onChange={(e) => setApplyLayoutAtStart(e.target.checked)}
            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
          <LayoutTemplate className="w-3.5 h-3.5 shrink-0" />
          <span>Layout at start</span>
        </label>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={undo}
          disabled={undoStack.length === 0}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Undo (Ctrl/Cmd+Z)"
        >
          <Undo2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={redoStack.length === 0}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Redo (Ctrl/Cmd+Shift+Z)"
        >
          <Redo2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />

        {/* Zoom controls */}
        <button
          type="button"
          onClick={() => zoomOut({ duration: 200 })}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <button
          type="button"
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
          className="px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-[48px] text-center"
          title="Fit view — click to reset"
        >
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 tabular-nums">{zoomPercent}</span>
        </button>
        <button
          type="button"
          onClick={() => zoomIn({ duration: 200 })}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
        <button
          type="button"
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Fit to screen"
        >
          <Maximize className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </Panel>
  );
}

export const CanvasBottomBar = memo(CanvasBottomBarInner);
