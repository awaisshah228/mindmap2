"use client";

import { useState, useEffect } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import AppSidebar from "@/components/sidebar/AppSidebar";
import CanvasToolbar from "@/components/toolbar/CanvasToolbar";
import DiagramCanvas from "@/components/canvas/DiagramCanvas";
import { Undo2, Redo2, Hand, ZoomIn, ZoomOut, Menu } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export default function EditorLayout() {
  const { activeTool, setActiveTool, undo, redo } = useCanvasStore();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile overlay when sidebar is open */}
      {isMobile && sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 px-4 flex items-center justify-between bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen((o) => !o)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm text-gray-500">PRIVATE / Grand</span>
            <span className="text-sm font-medium text-gray-800">untitled</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
            >
              Share
            </button>
          </div>
        </header>

        {/* Main content: toolbar + canvas */}
        <div className="flex-1 flex min-h-0">
          <CanvasToolbar activeTool={activeTool} onToolChange={setActiveTool} />
          <div className="flex-1 relative">
            <DiagramCanvas />
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-4 right-16 flex items-center gap-1 bg-white rounded-lg shadow border border-gray-200 p-1">
          <button
            type="button"
            onClick={undo}
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={redo}
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4 text-gray-600" />
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button
            type="button"
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Pan"
          >
            <Hand className="w-4 h-4 text-gray-600" />
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button
            type="button"
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-xs text-gray-500 px-2">100%</span>
          <button
            type="button"
            className="p-2 rounded hover:bg-gray-100"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
