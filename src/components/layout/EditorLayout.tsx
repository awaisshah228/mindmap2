"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { useProjectPersistence } from "@/lib/store/project-storage";
import AppSidebar from "@/components/sidebar/AppSidebar";
import CanvasToolbar from "@/components/toolbar/CanvasToolbar";
import DiagramCanvas from "@/components/canvas/DiagramCanvas";
import { cn } from "@/lib/utils";
import { diagramToExcalidraw } from "@/lib/excalidraw-convert";
import { excalidrawToDiagram } from "@/lib/excalidraw-convert";
import { diagramToDrawioXml } from "@/lib/diagram-to-drawio";
import { excalidrawToDrawioXml } from "@/lib/excalidraw-to-drawio";
import { validateAndFixXml } from "@/lib/drawio-utils";
import { drawioXmlToDiagram } from "@/lib/drawio-to-diagram";
import { parseStreamingElementsBuffer } from "@/lib/ai/streaming-json-parser";
import { normalizeSkeletons } from "@/lib/skeleton-normalize";
import { applyNodesAndEdgesInChunks } from "@/lib/chunked-nodes";
import { toPng } from "html-to-image";

const ExcalidrawCanvas = dynamic(
  () => import("@/components/canvas/ExcalidrawCanvas").then((m) => m.default),
  { ssr: false }
);

const DrawioCanvas = dynamic(
  () => import("@/components/canvas/DrawioCanvas").then((m) => m.default),
  { ssr: false }
);
import { NodeDetailsPanel } from "@/components/panels/NodeDetailsPanel";
import { KeyboardShortcutsPanel } from "@/components/panels/KeyboardShortcutsPanel";
import { SearchPanel } from "@/components/panels/SearchPanel";
// PresentationMode is rendered inside DiagramCanvas
import { PresentationFlowEditor } from "@/components/panels/PresentationMode";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { DailyNotesPanel } from "@/components/panels/DailyNotesPanel";
import { ExportImportPanel } from "@/components/panels/ExportImportPanel";
import { SharePanel } from "@/components/panels/SharePanel";
import { ThemeProvider } from "@/components/panels/ThemeProvider";
import { DrawioProvider } from "@/contexts/DrawioContext";
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
  PencilRuler,
  Workflow,
  Wand2,
  ChevronDown,
  Loader2,
  ImagePlus,
  SlidersHorizontal,
  Circle,
  Square,
  Grid3X3,
  Minus,
  LayoutTemplate,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AuthStrip } from "@/components/auth/AuthStrip";

export default function EditorLayout() {
  const router = useRouter();
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
  const canvasMode = useCanvasStore((s) => s.canvasMode);
  const setCanvasMode = useCanvasStore((s) => s.setCanvasMode);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setExcalidrawData = useCanvasStore((s) => s.setExcalidrawData);
  const excalidrawData = useCanvasStore((s) => s.excalidrawData);
  const drawioData = useCanvasStore((s) => s.drawioData);
  const setDrawioData = useCanvasStore((s) => s.setDrawioData);
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const setHasUnsavedChanges = useCanvasStore((s) => s.setHasUnsavedChanges);
  const setPendingFitView = useCanvasStore((s) => s.setPendingFitView);
  const canvasBackgroundVariant = useCanvasStore((s) => s.canvasBackgroundVariant);
  const setCanvasBackgroundVariant = useCanvasStore((s) => s.setCanvasBackgroundVariant);
  const isMobile = useMediaQuery("(max-width: 768px)");

  const handleConvertToExcalidraw = useCallback(async () => {
    const skeletons = diagramToExcalidraw(nodes, edges);
    if (skeletons.length === 0) {
      setExcalidrawData(null);
      setCanvasMode("excalidraw");
      return;
    }
    const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
    const elements = convertToExcalidrawElements(skeletons as never[], { regenerateIds: false });
    setExcalidrawData({ elements, appState: {} });
    setCanvasMode("excalidraw");
    setHasUnsavedChanges(true);
  }, [nodes, edges, setExcalidrawData, setCanvasMode, setHasUnsavedChanges]);

  const handleConvertToDiagram = useCallback(() => {
    const els = excalidrawData?.elements ?? [];
    const { nodes: newNodes, edges: newEdges } = excalidrawToDiagram(Array.isArray(els) ? els : []);
    pushUndo();
    applyNodesAndEdgesInChunks(setNodes, setEdges, newNodes, newEdges);
    setCanvasMode("reactflow");
    setPendingFitView(true);
    setHasUnsavedChanges(true);
  }, [excalidrawData, pushUndo, setNodes, setEdges, setCanvasMode, setPendingFitView, setHasUnsavedChanges]);

  const handleConvertDrawioToDiagram = useCallback(() => {
    const xml = drawioData ?? "";
    if (!xml.trim()) return;
    const { nodes: newNodes, edges: newEdges } = drawioXmlToDiagram(xml);
    if (newNodes.length === 0 && newEdges.length === 0) {
      if (typeof window !== "undefined") window.alert("No editable shapes found. Use structural conversion (Instant) instead of As image.");
      return;
    }
    pushUndo();
    applyNodesAndEdgesInChunks(setNodes, setEdges, newNodes, newEdges);
    setCanvasMode("reactflow");
    setPendingFitView(true);
    setHasUnsavedChanges(true);
  }, [drawioData, pushUndo, setNodes, setEdges, setCanvasMode, setPendingFitView, setHasUnsavedChanges]);

  const handleAddDiagramAsImageToExcalidraw = useCallback(async () => {
    const el = document.querySelector(".react-flow");
    if (!el || !(el instanceof HTMLElement)) {
      if (typeof window !== "undefined") window.alert("Diagram canvas not found.");
      return;
    }
    const isDark = document.documentElement.classList.contains("dark");
    const bg = isDark ? "#111827" : "#f9fafb";
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: bg,
        filter: (node) => {
          const c = node as HTMLElement;
          if (c.classList?.contains("react-flow__controls")) return false;
          if (c.classList?.contains("react-flow__minimap")) return false;
          if (c.closest?.(".react-flow__panel")) return false;
          return true;
        },
      });
      const fileId = `diagram-img-${Date.now()}`;
      const imgEl = document.createElement("img");
      imgEl.src = dataUrl;
      await new Promise<void>((res, rej) => {
        imgEl.onload = () => res();
        imgEl.onerror = rej;
      });
      const w = Math.min(imgEl.naturalWidth, 1600);
      const h = Math.min(imgEl.naturalHeight, 1200);
      const existing = excalidrawData ?? { elements: [], appState: {} };
      const imageElement = {
        type: "image",
        id: `ex-img-${fileId}`,
        fileId,
        x: 0,
        y: 0,
        width: w,
        height: h,
        angle: 0,
        strokeColor: "#000",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        seed: Math.floor(Math.random() * 1e9),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1e9),
        isDeleted: false,
        groupIds: [] as string[],
      };
      const files = {
        ...(existing.files ?? {}),
        [fileId]: { mimeType: "image/png", id: fileId, dataURL: dataUrl },
      };
      setExcalidrawData({
        elements: [...(Array.isArray(existing.elements) ? existing.elements : []), imageElement],
        appState: existing.appState ?? {},
        files,
      });
      setCanvasMode("excalidraw");
      setHasUnsavedChanges(true);
    } catch (err) {
      console.error("Add diagram as image failed:", err);
      if (typeof window !== "undefined") window.alert("Failed to add diagram as image to Excalidraw.");
    }
  }, [excalidrawData, setExcalidrawData, setCanvasMode, setHasUnsavedChanges]);

  const handleAddDiagramToDrawio = useCallback(async () => {
    const el = document.querySelector(".react-flow");
    if (!el || !(el instanceof HTMLElement)) {
      if (typeof window !== "undefined") window.alert("Diagram canvas not found.");
      return;
    }
    const isDark = document.documentElement.classList.contains("dark");
    const bg = isDark ? "#111827" : "#f9fafb";
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: bg,
        filter: (node) => {
          const c = node as HTMLElement;
          if (c.classList?.contains("react-flow__controls")) return false;
          if (c.classList?.contains("react-flow__minimap")) return false;
          if (c.closest?.(".react-flow__panel")) return false;
          return true;
        },
      });
      const imgEl = document.createElement("img");
      imgEl.src = dataUrl;
      await new Promise<void>((res, rej) => {
        imgEl.onload = () => res();
        imgEl.onerror = rej;
      });
      const w = Math.min(imgEl.naturalWidth, 1600);
      const h = Math.min(imgEl.naturalHeight, 1200);
      const xml = diagramToDrawioXml(dataUrl, w, h);
      setDrawioData(xml);
      setCanvasMode("drawio");
      setHasUnsavedChanges(true);
    } catch (err) {
      console.error("Add diagram to Draw.io failed:", err);
      if (typeof window !== "undefined") window.alert("Failed to add diagram to Draw.io.");
    }
  }, [setDrawioData, setCanvasMode, setHasUnsavedChanges]);

  const handleConvertToDrawio = useCallback(() => {
    const skeletons = diagramToExcalidraw(nodes, edges);
    if (skeletons.length === 0) {
      setDrawioData(null);
      setCanvasMode("drawio");
      setHasUnsavedChanges(true);
      return;
    }
    let xml = excalidrawToDrawioXml(skeletons as { type: string; id?: string; x: number; y: number; width?: number; height?: number; label?: { text?: string }; start?: { id?: string }; end?: { id?: string } }[]);
    const v = validateAndFixXml(xml);
    if (v.fixed) xml = v.fixed;
    setDrawioData(xml);
    setCanvasMode("drawio");
    setHasUnsavedChanges(true);
  }, [nodes, edges, setDrawioData, setCanvasMode, setHasUnsavedChanges]);

  const [convertDrawioLoading, setConvertDrawioLoading] = useState(false);

  const handleConvertToDrawioWithAI = useCallback(async () => {
    if (nodes.length === 0 && edges.length === 0) {
      setDrawioData(null);
      setCanvasMode("drawio");
      setHasUnsavedChanges(true);
      return;
    }
    setConvertDrawioLoading(true);
    try {
      const { llmProvider, llmModel, llmApiKey } = useCanvasStore.getState();
      const res = await fetch("/api/diagrams/convert-to-excalidraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nodes,
          edges,
          llmProvider,
          llmModel,
          llmApiKey: llmApiKey || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data?.error as string) || "Conversion failed");
      }
      if (!res.body) throw new Error("No response body");
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let lastCount = 0;
      const STREAM_BATCH_SIZE = 5;
      const nodeIds = (nodes as { id?: string }[]).map((n) => n.id).filter(Boolean) as string[];
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (value) streamBuffer += decoder.decode(value, { stream: true });
        const parsed = parseStreamingElementsBuffer(streamBuffer);
        const newCount = parsed.elements.length - lastCount;
        const shouldUpdate = parsed.elements.length > lastCount && (newCount >= STREAM_BATCH_SIZE || done);
        if (shouldUpdate) {
          const normalized = normalizeSkeletons(parsed.elements, nodeIds);
          let xml = excalidrawToDrawioXml(normalized as Parameters<typeof excalidrawToDrawioXml>[0]);
          const v = validateAndFixXml(xml);
          if (v.fixed) xml = v.fixed;
          setDrawioData(xml);
          setCanvasMode("drawio");
          lastCount = parsed.elements.length;
        }
        if (done) break;
      }
      const finalParsed = parseStreamingElementsBuffer(streamBuffer);
      const sk = finalParsed.elements.length > 0
        ? normalizeSkeletons(finalParsed.elements, nodeIds)
        : diagramToExcalidraw(nodes, edges);
      let xml = excalidrawToDrawioXml(sk as Parameters<typeof excalidrawToDrawioXml>[0]);
      const v = validateAndFixXml(xml);
      if (v.fixed) xml = v.fixed;
      setDrawioData(xml);
      setCanvasMode("drawio");
      setHasUnsavedChanges(true);
    } catch (err) {
      console.error("Convert to Draw.io (AI) failed:", err);
      const message = err instanceof Error ? err.message : "Conversion failed";
      if (typeof window !== "undefined") window.alert(message);
    } finally {
      setConvertDrawioLoading(false);
    }
  }, [nodes, edges, setDrawioData, setCanvasMode, setHasUnsavedChanges]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [convertExcalidrawLoading, setConvertExcalidrawLoading] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const handleConvertToExcalidrawWithAI = useCallback(async () => {
    if (nodes.length === 0 && edges.length === 0) {
      setExcalidrawData(null);
      setCanvasMode("excalidraw");
      return;
    }
    setConvertExcalidrawLoading(true);
    try {
      const { llmProvider, llmModel, llmApiKey } = useCanvasStore.getState();
      const res = await fetch("/api/diagrams/convert-to-excalidraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nodes,
          edges,
          llmProvider,
          llmModel,
          llmApiKey: llmApiKey || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data?.error as string) || "Conversion failed");
      }
      if (!res.body) throw new Error("No response body");
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let lastCount = 0;
      const STREAM_BATCH_SIZE = 5;
      const nodeIds = (nodes as { id?: string }[]).map((n) => n.id).filter(Boolean) as string[];
      const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (value) streamBuffer += decoder.decode(value, { stream: true });
        const parsed = parseStreamingElementsBuffer(streamBuffer);
        const newCount = parsed.elements.length - lastCount;
        const shouldUpdate = parsed.elements.length > lastCount && (newCount >= STREAM_BATCH_SIZE || done);
        if (shouldUpdate) {
          const normalized = normalizeSkeletons(parsed.elements, nodeIds);
          const elements = convertToExcalidrawElements(normalized as never[], { regenerateIds: false });
          setExcalidrawData({ elements, appState: {} });
          setCanvasMode("excalidraw");
          lastCount = parsed.elements.length;
        }
        if (done) break;
      }
      const finalParsed = parseStreamingElementsBuffer(streamBuffer);
      if (finalParsed.elements.length === 0) {
        const manual = diagramToExcalidraw(nodes, edges);
        const elements = convertToExcalidrawElements(manual as never[], { regenerateIds: false });
        setExcalidrawData({ elements, appState: {} });
      } else {
        const normalized = normalizeSkeletons(finalParsed.elements, nodeIds);
        const elements = convertToExcalidrawElements(normalized as never[], { regenerateIds: false });
        setExcalidrawData({ elements, appState: {} });
      }
      setCanvasMode("excalidraw");
      setHasUnsavedChanges(true);
    } catch (err) {
      console.error("Convert to Excalidraw (AI) failed:", err);
      const message = err instanceof Error ? err.message : "Conversion failed";
      if (typeof window !== "undefined") window.alert(message);
    } finally {
      setConvertExcalidrawLoading(false);
    }
  }, [nodes, edges, setExcalidrawData, setCanvasMode, setHasUnsavedChanges]);

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
          {/* Top bar — hidden during presentation; scrollable when content overflows */}
          <header className={`h-12 flex items-center overflow-x-auto overflow-y-hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700  ${presentationMode ? "hidden" : ""}`}>
            <div className="flex items-center justify-between gap-4 px-4 w-max min-w-full">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((o) => !o)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              {/* Switch between Diagram (React Flow) and Excalidraw on same canvas area */}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 bg-gray-50 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setCanvasMode("reactflow")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    canvasMode === "reactflow"
                      ? "bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                  title="Diagram canvas (nodes, edges, shapes)"
                >
                  <Workflow className="w-3.5 h-3.5" />
                  Diagram
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasMode("excalidraw")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    canvasMode === "excalidraw"
                      ? "bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                  title="Excalidraw (draw, shapes, arrows)"
                >
                  <PencilRuler className="w-3.5 h-3.5" />
                  Excalidraw
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasMode("drawio")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    canvasMode === "drawio"
                      ? "bg-white dark:bg-gray-700 text-violet-600 dark:text-violet-400 shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                  title="Draw.io (diagrams.net editor)"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  Draw.io
                </button>
                {canvasMode === "reactflow" && (nodes?.length > 0 || edges?.length > 0) && (
                  <Dropdown.Root>
                    <Dropdown.Trigger asChild>
                      <button
                        type="button"
                        disabled={convertExcalidrawLoading || convertDrawioLoading}
                        className="flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors whitespace-nowrap disabled:opacity-60"
                        title="Convert diagram to Excalidraw"
                      >
                        {(convertExcalidrawLoading || convertDrawioLoading) ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            → Excalidraw
                            <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </Dropdown.Trigger>
                    <Dropdown.Portal>
                      <Dropdown.Content
                        className="min-w-[180px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 z-[300]"
                        sideOffset={4}
                        align="start"
                      >
                        <Dropdown.Label className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">→ Excalidraw</Dropdown.Label>
                        <Dropdown.Item
                          className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 outline-none cursor-pointer"
                          onSelect={() => handleConvertToExcalidraw()}
                        >
                          Instant
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 outline-none cursor-pointer"
                          onSelect={() => handleConvertToExcalidrawWithAI()}
                        >
                          With AI
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 outline-none cursor-pointer flex items-center gap-2"
                          onSelect={() => handleAddDiagramAsImageToExcalidraw()}
                        >
                          <ImagePlus className="w-3.5 h-3.5" />
                          As image
                        </Dropdown.Item>
                        <Dropdown.Separator className="h-px bg-gray-200 dark:bg-gray-600 my-1" />
                        <Dropdown.Label className="px-3 py-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">→ Draw.io</Dropdown.Label>
                        <Dropdown.Item
                          className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 outline-none cursor-pointer"
                          onSelect={() => handleConvertToDrawio()}
                        >
                          Instant
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 outline-none cursor-pointer"
                          onSelect={() => handleConvertToDrawioWithAI()}
                        >
                          With AI
                        </Dropdown.Item>
                        <Dropdown.Item
                          className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 outline-none cursor-pointer flex items-center gap-2"
                          onSelect={() => handleAddDiagramToDrawio()}
                        >
                          <ImagePlus className="w-3.5 h-3.5" />
                          As image (not editable; may have export issues)
                        </Dropdown.Item>
                      </Dropdown.Content>
                    </Dropdown.Portal>
                  </Dropdown.Root>
                )}
                {canvasMode === "excalidraw" && (excalidrawData?.elements?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={handleConvertToDiagram}
                    className="text-[11px] px-2 py-1 rounded-md text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors whitespace-nowrap"
                    title="Convert Excalidraw to diagram"
                  >
                    → Diagram
                  </button>
                )}
                {canvasMode === "drawio" && (drawioData?.trim?.()?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={handleConvertDrawioToDiagram}
                    className="text-[11px] px-2 py-1 rounded-md text-gray-500 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors whitespace-nowrap"
                    title="Convert Draw.io to diagram (structural shapes only; images are skipped)"
                  >
                    → Diagram
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => router.push("/ai-diagram")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                  title="Generate diagram with AI (works for both Diagram and Excalidraw)"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  AI
                </button>
              </div>
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
            <div className="flex items-center gap-1 shrink-0">
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
              <Dropdown.Root>
                <Dropdown.Trigger asChild>
                  <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Tools & options"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </Dropdown.Trigger>
                <Dropdown.Portal>
                  <Dropdown.Content
                    className="min-w-[200px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 z-[300]"
                    sideOffset={4}
                    align="end"
                  >
                    {canvasMode === "reactflow" && (nodes?.length > 0 || edges?.length > 0) && (
                      <Dropdown.Sub>
                        <Dropdown.SubTrigger className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 outline-none cursor-pointer data-[highlighted]:bg-violet-50 dark:data-[highlighted]:bg-violet-900/20 flex items-center justify-between">
                          Convert to Excalidraw
                          <ChevronDown className="w-3 h-3 ml-1 rotate-[-90deg]" />
                        </Dropdown.SubTrigger>
                        <Dropdown.SubContent
                          className="min-w-[140px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1"
                          sideOffset={4}
                        >
                            <Dropdown.Item
                              className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 outline-none cursor-pointer"
                              onSelect={() => handleConvertToExcalidraw()}
                            >
                              Instant
                            </Dropdown.Item>
                            <Dropdown.Item
                              className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 outline-none cursor-pointer"
                              onSelect={() => handleConvertToExcalidrawWithAI()}
                            >
                              With AI
                            </Dropdown.Item>
                            <Dropdown.Item
                              className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 outline-none cursor-pointer flex items-center gap-2"
                              onSelect={() => handleAddDiagramAsImageToExcalidraw()}
                            >
                              <ImagePlus className="w-3.5 h-3.5" />
                              As image
                            </Dropdown.Item>
                          </Dropdown.SubContent>
                      </Dropdown.Sub>
                    )}
                    {canvasMode === "reactflow" && (
                      <Dropdown.Sub>
                        <Dropdown.SubTrigger className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 outline-none cursor-pointer data-[highlighted]:bg-violet-50 dark:data-[highlighted]:bg-violet-900/20 flex items-center justify-between">
                          Canvas background
                          <ChevronDown className="w-3 h-3 ml-1 rotate-[-90deg]" />
                        </Dropdown.SubTrigger>
                        <Dropdown.SubContent
                          className="min-w-[140px] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1"
                          sideOffset={4}
                        >
                            <Dropdown.Item
                              className="px-3 py-2 text-xs flex items-center gap-2 outline-none cursor-pointer data-[highlighted]:bg-violet-50 dark:data-[highlighted]:bg-violet-900/20"
                              onSelect={() => setCanvasBackgroundVariant("dots")}
                            >
                              <Grid3X3 className="w-3.5 h-3.5 text-gray-500" />
                              Dots
                              {canvasBackgroundVariant === "dots" && <span className="text-violet-500 ml-auto">✓</span>}
                            </Dropdown.Item>
                            <Dropdown.Item
                              className="px-3 py-2 text-xs flex items-center gap-2 outline-none cursor-pointer data-[highlighted]:bg-violet-50 dark:data-[highlighted]:bg-violet-900/20"
                              onSelect={() => setCanvasBackgroundVariant("lines")}
                            >
                              <Square className="w-3.5 h-3.5 text-gray-500" />
                              Lines
                              {canvasBackgroundVariant === "lines" && <span className="text-violet-500 ml-auto">✓</span>}
                            </Dropdown.Item>
                            <Dropdown.Item
                              className="px-3 py-2 text-xs flex items-center gap-2 outline-none cursor-pointer data-[highlighted]:bg-violet-50 dark:data-[highlighted]:bg-violet-900/20"
                              onSelect={() => setCanvasBackgroundVariant("cross")}
                            >
                              <Circle className="w-3.5 h-3.5 text-gray-500" />
                              Cross
                              {canvasBackgroundVariant === "cross" && <span className="text-violet-500 ml-auto">✓</span>}
                            </Dropdown.Item>
                            <Dropdown.Item
                              className="px-3 py-2 text-xs flex items-center gap-2 outline-none cursor-pointer data-[highlighted]:bg-violet-50 dark:data-[highlighted]:bg-violet-900/20"
                              onSelect={() => setCanvasBackgroundVariant("none")}
                            >
                              <Minus className="w-3.5 h-3.5 text-gray-500" />
                              None
                              {canvasBackgroundVariant === "none" && <span className="text-violet-500 ml-auto">✓</span>}
                            </Dropdown.Item>
                          </Dropdown.SubContent>
                      </Dropdown.Sub>
                    )}
                    <Dropdown.Item
                      className="px-3 py-2 text-xs text-gray-700 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 outline-none cursor-pointer flex items-center gap-2"
                      onSelect={() => router.push("/ai-diagram")}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      Generate with AI
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown.Portal>
              </Dropdown.Root>
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
                onClick={() => setShareOpen(true)}
                className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
                title="Share"
              >
                Share
              </button>
            </div>
            </div>
          </header>

          {/* Main content: same area for Diagram (React Flow) or Excalidraw */}
          <div className="flex-1 flex min-h-0 relative">
            {canvasMode === "reactflow" && (
              <>
                {!presentationMode && (
                  <CanvasToolbar activeTool={activeTool} onToolChange={setActiveTool} />
                )}
                <div className="flex-1 relative">
                  <DiagramCanvas />
                </div>
              </>
            )}
            {canvasMode === "excalidraw" && (
              <div className="flex-1 relative min-w-0">
                <ExcalidrawCanvas />
              </div>
            )}
            {canvasMode === "drawio" && (
              <DrawioProvider>
                <div className="flex-1 relative min-w-0">
                  <DrawioCanvas />
                </div>
              </DrawioProvider>
            )}
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
        <SharePanel open={shareOpen} onClose={() => setShareOpen(false)} />
        <PresentationFlowEditor />
      </div>
    </ThemeProvider>
  );
}
