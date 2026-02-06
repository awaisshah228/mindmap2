"use client";

import { useState, useEffect, useRef } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { useProjectPersistence } from "@/lib/store/project-storage";
import AppSidebar from "@/components/sidebar/AppSidebar";
import CanvasToolbar from "@/components/toolbar/CanvasToolbar";
import DiagramCanvas from "@/components/canvas/DiagramCanvas";
import { NodeDetailsPanel } from "@/components/panels/NodeDetailsPanel";
import { KeyboardShortcutsPanel } from "@/components/panels/KeyboardShortcutsPanel";
import { SearchPanel } from "@/components/panels/SearchPanel";
// PresentationMode is rendered inside DiagramCanvas
import { PresentationFlowEditor } from "@/components/panels/PresentationMode";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { DailyNotesPanel } from "@/components/panels/DailyNotesPanel";
import { ExportImportPanel } from "@/components/panels/ExportImportPanel";
import { ThemeProvider } from "@/components/panels/ThemeProvider";
import {
  Menu,
  Search,
  Keyboard,
  Settings,
  Calendar,
  Download,
  Focus,
  Play,
  ListOrdered,
} from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AuthStrip } from "@/components/auth/AuthStrip";

export default function EditorLayout() {
  // ─── Project persistence ────────────────────────────────────────
  useProjectPersistence();

  const { activeTool, setActiveTool } = useCanvasStore();
  const setSearchOpen = useCanvasStore((s) => s.setSearchOpen);
  const setShortcutsOpen = useCanvasStore((s) => s.setShortcutsOpen);
  const setSettingsOpen = useCanvasStore((s) => s.setSettingsOpen);
  const setDailyNotesOpen = useCanvasStore((s) => s.setDailyNotesOpen);
  const focusedBranchNodeId = useCanvasStore((s) => s.focusedBranchNodeId);
  const setFocusedBranchNodeId = useCanvasStore((s) => s.setFocusedBranchNodeId);
  const presentationMode = useCanvasStore((s) => s.presentationMode);
  const setPresentationMode = useCanvasStore((s) => s.setPresentationMode);
  const setPresentationEditorOpen = useCanvasStore((s) => s.setPresentationEditorOpen);
  const activeProjectId = useCanvasStore((s) => s.activeProjectId);
  const projects = useCanvasStore((s) => s.projects);
  const renameProject = useCanvasStore((s) => s.renameProject);
  const llmApiKey = useCanvasStore((s) => s.llmApiKey);
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeProjectName = activeProject?.name ?? "Untitled";

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.focus();
  }, [editingTitle]);

  const handleTitleSubmit = () => {
    const val = titleInputRef.current?.value.trim();
    if (val && val !== activeProjectName && activeProjectId) {
      renameProject(activeProjectId, val);
    }
    setEditingTitle(false);
  };

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  return (
    <ThemeProvider>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        {/* Mobile overlay when sidebar is open */}
        {!presentationMode && isMobile && sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        {!presentationMode && (
          <AppSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            isMobile={isMobile}
          />
        )}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar — hidden during presentation */}
          <header className={`h-12 px-4 flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${presentationMode ? "hidden" : ""}`}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              {editingTitle ? (
                <input
                  ref={titleInputRef}
                  defaultValue={activeProjectName}
                  className="text-sm font-medium text-gray-800 dark:text-gray-200 bg-transparent border-b border-violet-400 outline-none px-0.5 py-0"
                  onBlur={handleTitleSubmit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSubmit();
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="text-sm font-medium text-gray-800 dark:text-gray-200 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  title="Click to rename project"
                >
                  {activeProjectName}
                </button>
              )}
              {llmApiKey && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded" title="AI calls are made directly from your browser using your API key">
                  Direct
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Focus mode indicator */}
              {focusedBranchNodeId && (
                <button
                  type="button"
                  onClick={() => setFocusedBranchNodeId(null)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium hover:bg-amber-100 transition-colors mr-2"
                >
                  <Focus className="w-3.5 h-3.5" />
                  Focus mode
                  <span className="text-amber-400 ml-0.5">x</span>
                </button>
              )}

              {/* Quick action buttons */}
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Search (Ctrl+F)"
              >
                <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => setPresentationMode(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Present (P)"
              >
                <Play className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => setPresentationEditorOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Edit presentation flow"
              >
                <ListOrdered className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => setDailyNotesOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Daily Notes (Ctrl+Shift+D)"
              >
                <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Export / Import"
              >
                <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                type="button"
                onClick={() => setShortcutsOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Keyboard shortcuts (Shift+?)"
              >
                <Keyboard className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 mx-1" />
              <AuthStrip />
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
            {!presentationMode && (
              <CanvasToolbar activeTool={activeTool} onToolChange={setActiveTool} />
            )}
            <div className="flex-1 relative">
              <DiagramCanvas />
            </div>
          </div>

          {/* Bottom bar is now inside DiagramCanvas for React Flow context access */}
        </div>

        {/* Feature panels */}
        <NodeDetailsPanel />
        <KeyboardShortcutsPanel />
        <SearchPanel />
        <SettingsPanel />
        <DailyNotesPanel />
        <ExportImportPanel open={exportOpen} onClose={() => setExportOpen(false)} />
        <PresentationFlowEditor />
      </div>
    </ThemeProvider>
  );
}
