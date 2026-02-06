"use client";

import { useCallback, useState } from "react";
import { X, FileJson, Image, Link2, Sparkles, Check } from "lucide-react";
import { toPng } from "html-to-image";
import { useUser } from "@clerk/nextjs";
import { useCanvasStore } from "@/lib/store/canvas-store";

interface SharePanelProps {
  open: boolean;
  onClose: () => void;
}

export function SharePanel({ open, onClose }: SharePanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const nodeNotes = useCanvasStore((s) => s.nodeNotes);
  const nodeTasks = useCanvasStore((s) => s.nodeTasks);
  const activeProjectId = useCanvasStore((s) => s.activeProjectId);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);

  const { isSignedIn } = useUser();
  const [copyLinkFeedback, setCopyLinkFeedback] = useState(false);

  // Export as JSON (same as ExportImportPanel)
  const handleExportJSON = useCallback(() => {
    const data = {
      version: 1,
      nodes,
      edges,
      nodeNotes,
      nodeTasks,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagram-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, nodeNotes, nodeTasks]);

  // Save as PNG (viewport capture)
  const handleSaveAsImage = useCallback(async () => {
    const el = document.querySelector(".react-flow");
    if (!el || !(el instanceof HTMLElement)) return;
    const isDark = document.documentElement.classList.contains("dark");
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: isDark ? "#111827" : "#f9fafb",
        filter: (node) => {
          const c = node as HTMLElement;
          if (c.classList?.contains("react-flow__controls")) return false;
          if (c.classList?.contains("react-flow__minimap")) return false;
          if (c.closest?.(".react-flow__panel")) return false;
          return true;
        },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `diagram-${Date.now()}.png`;
      a.click();
    } catch (err) {
      console.error("PNG export failed:", err);
    }
  }, []);

  // Copy shareable link (when signed in; include project id if cloud)
  const handleCopyLink = useCallback(async () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const path = "/editor";
    const params = new URLSearchParams();
    if (isSignedIn && activeProjectId) {
      params.set("project", activeProjectId);
    }
    const url = params.toString() ? `${origin}${path}?${params.toString()}` : `${origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyLinkFeedback(true);
      window.setTimeout(() => setCopyLinkFeedback(false), 2000);
    } catch {
      // ignore
    }
  }, [isSignedIn, activeProjectId]);

  const handlePremium = useCallback(() => {
    onClose();
    setSettingsOpen(true);
  }, [onClose, setSettingsOpen]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[380px] max-w-[90vw] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Share</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => { handleExportJSON(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors text-left"
          >
            <FileJson className="w-5 h-5 text-violet-500" />
            <div>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block">Export as JSON</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Download diagram data</span>
            </div>
          </button>

          <button
            type="button"
            onClick={async () => { await handleSaveAsImage(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors text-left"
          >
            <Image className="w-5 h-5 text-violet-500" />
            <div>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block">Save as image</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Download as PNG</span>
            </div>
          </button>

          {isSignedIn && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors text-left"
            >
              <Link2 className="w-5 h-5 text-violet-500" />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block">
                  {copyLinkFeedback ? "Link copied!" : "Share as link"}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Copy link to open this project
                </span>
              </div>
              {copyLinkFeedback && <Check className="w-4 h-4 text-green-500 shrink-0" />}
            </button>
          )}

          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={handlePremium}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-violet-500/20 border border-amber-400/30 dark:border-amber-500/30 hover:from-amber-500/30 hover:to-violet-500/30 transition-colors text-left"
            >
              <Sparkles className="w-5 h-5 text-amber-500" />
              <div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block">Premium</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">More credits & features</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
