"use client";

import { useMemo, useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";

export function SearchPanel() {
  const searchOpen = useCanvasStore((s) => s.searchOpen);
  const setSearchOpen = useCanvasStore((s) => s.setSearchOpen);
  const searchQuery = useCanvasStore((s) => s.searchQuery);
  const setSearchQuery = useCanvasStore((s) => s.setSearchQuery);
  const nodes = useCanvasStore((s) => s.nodes);
  const storeSetNodes = useCanvasStore((s) => s.setNodes);
  const setPendingFitView = useCanvasStore((s) => s.setPendingFitView);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const results = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return nodes.filter((n) => {
      const label = ((n.data?.label as string) ?? "").toLowerCase();
      const type = (n.type ?? "").toLowerCase();
      const note = (useCanvasStore.getState().nodeNotes[n.id] ?? "").toLowerCase();
      return label.includes(q) || type.includes(q) || note.includes(q);
    });
  }, [searchQuery, nodes]);

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      // Select the node and trigger fit view
      storeSetNodes((nds) =>
        nds.map((n) => ({ ...n, selected: n.id === nodeId }))
      );
      setPendingFitView(true);
      setSearchOpen(false);
    },
    [storeSetNodes, setPendingFitView, setSearchOpen]
  );

  if (!searchOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[480px] max-w-[90vw] flex flex-col max-h-[60vh]">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search nodes, labels, notes..."
            className="flex-1 text-sm text-gray-800 outline-none placeholder-gray-400"
            onKeyDown={(e) => {
              if (e.key === "Escape") setSearchOpen(false);
              if (e.key === "Enter" && results.length > 0) {
                handleSelectNode(results[0].id);
              }
            }}
          />
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            className="p-1 rounded hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-auto">
          {searchQuery.trim() && results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No results found
            </div>
          ) : (
            results.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => handleSelectNode(node.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-violet-50 text-left transition-colors"
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded flex items-center justify-center text-xs font-medium shrink-0",
                    node.type === "mindMap"
                      ? "bg-violet-100 text-violet-700"
                      : node.type === "stickyNote"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                  )}
                >
                  {(node.type ?? "N")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {(node.data?.label as string) || "Untitled"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {node.type}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
