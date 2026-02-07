"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import { Position } from "@xyflow/react";
import {
  FilePlus,
  Star,
  FolderOpen,
  Trash2,
  X,
  MoreHorizontal,
  Pencil,
  Copy,
  ChevronDown,
  ChevronRight,
  Clock,
  LayoutTemplate,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@clerk/nextjs";
import { useCanvasStore, type Project } from "@/lib/store/canvas-store";
import { CUSTOM_MARKER_IDS } from "@/components/edges/CustomMarkerDefs";
import { applyNodesAndEdgesInChunks } from "@/lib/chunked-nodes";
import { saveNow, createProjectApi, renameProjectApi, deleteProjectApi, duplicateProjectApi } from "@/lib/store/project-storage";

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

/** Relative time like "2h ago", "3d ago", etc. */
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

type TemplateItem = { id: string; label: string; level: string; description?: string; previewImageUrl?: string };

const GLOBAL_EDGE_COLORS = [
  { id: "red", label: "Red", hex: "#ef4444" },
  { id: "orange", label: "Orange", hex: "#f97316" },
  { id: "amber", label: "Amber", hex: "#eab308" },
  { id: "green", label: "Green", hex: "#22c55e" },
  { id: "blue", label: "Blue", hex: "#3b82f6" },
  { id: "violet", label: "Violet", hex: "#8b5cf6" },
  { id: "pink", label: "Pink", hex: "#ec4899" },
  { id: "teal", label: "Teal", hex: "#14b8a6" },
  { id: "gray", label: "Gray", hex: "#6b7280" },
  { id: "black", label: "Black", hex: "#1f2937" },
];

const EDGE_STROKE_WIDTHS = [1.5, 2, 4, 6, 8, 10, 12] as const;
const ARROW_MARKER_ID = CUSTOM_MARKER_IDS.arrowClosed;

export default function AppSidebar({ isOpen = true, onClose, isMobile }: AppSidebarProps) {
  const { isSignedIn } = useAuth();
  const persistenceSource = useCanvasStore((s) => s.persistenceSource);
  const projects = useCanvasStore((s) => s.projects);
  const activeProjectId = useCanvasStore((s) => s.activeProjectId);
  const switchProject = useCanvasStore((s) => s.switchProject);
  const setHasUnsavedChanges = useCanvasStore((s) => s.setHasUnsavedChanges);
  const toggleFavorite = useCanvasStore((s) => s.toggleFavorite);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setPendingFitView = useCanvasStore((s) => s.setPendingFitView);
  const setPendingFitViewNodeIds = useCanvasStore((s) => s.setPendingFitViewNodeIds);
  const setLibraryOpen = useCanvasStore((s) => s.setLibraryOpen);
  const defaultEdgeStrokeColor = useCanvasStore((s) => s.defaultEdgeStrokeColor);
  const setDefaultEdgeStrokeColor = useCanvasStore((s) => s.setDefaultEdgeStrokeColor);
  const defaultEdgeStrokeWidth = useCanvasStore((s) => s.defaultEdgeStrokeWidth);
  const setDefaultEdgeStrokeWidth = useCanvasStore((s) => s.setDefaultEdgeStrokeWidth);
  const defaultEdgeMarkerEnd = useCanvasStore((s) => s.defaultEdgeMarkerEnd);
  const defaultEdgeMarkerStart = useCanvasStore((s) => s.defaultEdgeMarkerStart);
  const setDefaultEdgeMarkers = useCanvasStore((s) => s.setDefaultEdgeMarkers);
  const edges = useCanvasStore((s) => s.edges);
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const selectedEdgeIds = useMemo(
    () => (edges as Edge[]).filter((e) => (e as { selected?: boolean }).selected).map((e) => e.id),
    [edges]
  );

  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [globalStylesOpen, setGlobalStylesOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(true);
  const [allOpen, setAllOpen] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Load templates for everyone (signed in or not); no auth required
  useEffect(() => {
    fetch("/api/presets?templates=true", { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: TemplateItem[]) => setTemplates(Array.isArray(list) ? list : []))
      .catch(() => setTemplates([]));
  }, []);

  /** Apply template data to canvas (supports groups, uses positions as-is). */
  const applyTemplateData = (data: { nodes: unknown[]; edges?: unknown[] }) => {
    const rawNodes = data.nodes as {
      id: string;
      type?: string;
      position?: { x: number; y: number };
      data?: Record<string, unknown>;
      parentId?: string;
      extent?: string;
      style?: Record<string, unknown>;
      width?: number;
      height?: number;
      sourcePosition?: string;
      targetPosition?: string;
    }[];
    const nodeIds = new Set(rawNodes.map((n) => n.id));
    const nodes: Node[] = rawNodes.map((n) => ({
      id: n.id,
      type: (n.type as string) || "rectangle",
      position: n.position ?? { x: 0, y: 0 },
      data: n.data ?? {},
      ...(n.style && { style: n.style }),
      ...(n.width != null && { width: n.width }),
      ...(n.height != null && { height: n.height }),
      ...(n.parentId && nodeIds.has(n.parentId) && { parentId: n.parentId, extent: (n.extent as "parent") ?? "parent" }),
      ...(n.sourcePosition && { sourcePosition: n.sourcePosition as Position }),
      ...(n.targetPosition && { targetPosition: n.targetPosition as Position }),
    }));
    const rawEdges = (data.edges ?? []) as { id?: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; data?: Record<string, unknown> }[];
    const edges: Edge[] = rawEdges
      .filter((e) => e && nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e, i) => ({
        id: e.id || `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        ...(e.sourceHandle && { sourceHandle: e.sourceHandle }),
        ...(e.targetHandle && { targetHandle: e.targetHandle }),
        ...(e.data && { data: e.data }),
      }));
    return { nodes, edges };
  };

  const loadTemplate = async (template: TemplateItem) => {
    const { id, label } = template;
    setTemplatesLoading(true);
    try {
      // Always create a new project with template name (works without sign-in)
      await createProjectApi(!!isSignedIn || persistenceSource === "cloud", label || "From template");

      // Fetch template data from API
      let data: { nodes?: unknown[]; edges?: unknown[] } | null = null;
      const presetRes = await fetch(`/api/diagrams/preset?preset=${encodeURIComponent(id)}`, { credentials: "omit" });
      if (presetRes.ok) {
        data = await presetRes.json();
      } else if (presetRes.status === 404) {
        const genRes = await fetch(`/api/diagrams/preset/generate?preset=${encodeURIComponent(id)}`, {
          method: "POST",
          credentials: "omit",
        });
        if (genRes.ok) data = await genRes.json();
      }

      if (data && Array.isArray(data.nodes) && data.nodes.length > 0) {
        const { nodes, edges } = applyTemplateData({ nodes: data.nodes, edges: data.edges ?? [] });
        pushUndo();
        await applyNodesAndEdgesInChunks(setNodes, setEdges, nodes, edges);
        setHasUnsavedChanges(true);
        saveNow();
        setPendingFitView(true);
        setPendingFitViewNodeIds(nodes.map((n) => n.id));
        onClose?.();
      }
    } finally {
      setTemplatesLoading(false);
    }
  };

  const favorites = useMemo(() => projects.filter((p) => p.isFavorite).sort((a, b) => b.updatedAt - a.updatedAt), [projects]);
  const recent = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5), [projects]);
  const allProjects = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt), [projects]);

  const handleCreate = async () => {
    const useApi = !!isSignedIn || persistenceSource === "cloud";
    await createProjectApi(useApi, "Untitled");
  };

  if (!isMobile && !isOpen) return null;

  return (
    <aside
      className={cn(
        "w-56 bg-gray-900 text-gray-300 flex flex-col h-full transition-transform duration-200 ease-out shrink-0",
        isMobile && "fixed left-0 top-0 bottom-0 z-50 shadow-xl",
        isMobile && !isOpen && "-translate-x-full",
        isMobile && isOpen && "translate-x-0"
      )}
    >
      <div className="p-3 flex items-center justify-between gap-2">
        {(isMobile || onClose) && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          onClick={handleCreate}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors",
            onClose ? "flex-1" : "w-full"
          )}
        >
          <FilePlus className="w-4 h-4" />
          New Project
        </button>
      </div>
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-300 hover:text-white text-sm transition-colors"
          title="Your library (all S3 uploads)"
        >
          <FolderOpen className="w-4 h-4" />
          Library
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {/* Global styles */}
        <Section title="Global styles" open={globalStylesOpen} onToggle={() => setGlobalStylesOpen((o) => !o)}>
          <li className="px-3 py-2">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mb-1">
              Default edge color
            </span>
            <p className="text-[10px] text-gray-500 mb-2">
              New edges use this color. Select edges on the canvas to apply to selection only.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDefaultEdgeStrokeColor(null)}
                title="Default (auto)"
                className={cn(
                  "w-6 h-6 rounded-md border-2 transition-all hover:scale-110",
                  defaultEdgeStrokeColor === null ? "border-violet-400 ring-1 ring-violet-400/50" : "border-gray-600 hover:border-gray-500"
                )}
                style={{ backgroundColor: "#94a3b8" }}
              />
              {GLOBAL_EDGE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDefaultEdgeStrokeColor(c.hex)}
                  title={c.label}
                  className={cn(
                    "w-6 h-6 rounded-md border-2 transition-all hover:scale-110",
                    defaultEdgeStrokeColor === c.hex ? "border-violet-400 ring-1 ring-violet-400/50" : "border-gray-600 hover:border-gray-500"
                  )}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mt-3 mb-1">
              Default stroke width
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setDefaultEdgeStrokeWidth(null)}
                title="Default (2px)"
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                  defaultEdgeStrokeWidth === null
                    ? "border-violet-400 bg-violet-800/40 text-violet-200"
                    : "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                )}
              >
                Auto
              </button>
              {EDGE_STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setDefaultEdgeStrokeWidth(w)}
                  title={`${w}px`}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                    defaultEdgeStrokeWidth === w
                      ? "border-violet-400 bg-violet-800/40 text-violet-200"
                      : "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider block mt-3 mb-1">
              Default markers
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setDefaultEdgeMarkers(null, null)}
                title="No arrows"
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                  defaultEdgeMarkerEnd === null && defaultEdgeMarkerStart === null
                    ? "border-violet-400 bg-violet-800/40 text-violet-200"
                    : "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                )}
              >
                None
              </button>
              <button
                type="button"
                onClick={() => setDefaultEdgeMarkers(ARROW_MARKER_ID, null)}
                title="Arrow at end"
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                  defaultEdgeMarkerEnd === ARROW_MARKER_ID && defaultEdgeMarkerStart === null
                    ? "border-violet-400 bg-violet-800/40 text-violet-200"
                    : "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                )}
              >
                Arrow end
              </button>
              <button
                type="button"
                onClick={() => setDefaultEdgeMarkers(ARROW_MARKER_ID, ARROW_MARKER_ID)}
                title="Arrow at both ends"
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium border transition-all",
                  defaultEdgeMarkerEnd === ARROW_MARKER_ID && defaultEdgeMarkerStart === ARROW_MARKER_ID
                    ? "border-violet-400 bg-violet-800/40 text-violet-200"
                    : "border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300"
                )}
              >
                Arrow both
              </button>
            </div>
            {edges.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {selectedEdgeIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      pushUndo();
                      const idSet = new Set(selectedEdgeIds);
                      setEdges(
                        (edges as Edge[]).map((e) => {
                          if (!idSet.has(e.id)) return e;
                          return {
                            ...e,
                            data: {
                              ...(e.data ?? {}),
                              strokeColor: defaultEdgeStrokeColor ?? undefined,
                              strokeWidth: defaultEdgeStrokeWidth ?? undefined,
                            },
                            markerEnd: defaultEdgeMarkerEnd ?? undefined,
                            markerStart: defaultEdgeMarkerStart ?? undefined,
                          };
                        })
                      );
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-violet-800/80 hover:bg-violet-700 text-white border border-violet-600"
                  >
                    Apply to selected edges ({selectedEdgeIds.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    pushUndo();
                    setEdges(
                      (edges as Edge[]).map((e) => ({
                        ...e,
                        data: {
                          ...(e.data ?? {}),
                          strokeColor: defaultEdgeStrokeColor ?? undefined,
                          strokeWidth: defaultEdgeStrokeWidth ?? undefined,
                        },
                        markerEnd: defaultEdgeMarkerEnd ?? undefined,
                        markerStart: defaultEdgeMarkerStart ?? undefined,
                      }))
                    );
                    setHasUnsavedChanges(true);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-600"
                >
                  Apply to all edges
                </button>
              </div>
            )}
          </li>
        </Section>

        {/* Templates */}
        <Section title="Templates" open={templatesOpen} onToggle={() => setTemplatesOpen((o) => !o)}>
          {templates.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-500">No templates yet</li>
          ) : (
            (() => {
              const byLevel = templates.reduce<Record<string, TemplateItem[]>>((acc, t) => {
                const l = t.level || "other";
                if (!acc[l]) acc[l] = [];
                acc[l].push(t);
                return acc;
              }, {});
              const levels = Object.keys(byLevel).sort();
              return (
                <>
                  {levels.map((level) => (
                    <li key={level} className="mt-1">
                      <span className="px-3 text-[10px] font-medium text-gray-500 uppercase tracking-wider block">
                        {level.replace(/-/g, " ")}
                      </span>
                      <ul className="mt-0.5 space-y-0.5">
                        {byLevel[level].map((t) => (
                          <li key={t.id}>
                            <button
                              type="button"
                              disabled={templatesLoading}
                              onClick={() => loadTemplate(t)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm hover:bg-gray-800 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
                            >
                              {(t.previewImageUrl && (t.previewImageUrl.startsWith("http://") || t.previewImageUrl.startsWith("https://"))) ? (
                                <img
                                  src={t.previewImageUrl}
                                  alt=""
                                  className="w-6 h-6 object-contain rounded shrink-0 bg-gray-800/50"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <LayoutTemplate className="w-3.5 h-3.5 opacity-60 shrink-0" />
                              )}
                              <span className="flex-1 truncate">{t.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </>
              );
            })()
          )}
        </Section>

        {/* Favorites */}
        {favorites.length > 0 && (
          <Section title="Favorites" open={favoritesOpen} onToggle={() => setFavoritesOpen((o) => !o)}>
            {favorites.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                isActive={p.id === activeProjectId}
                onSwitch={() => switchProject(p.id)}
                onRename={(name) => renameProjectApi(p.id, name)}
                onDelete={() => deleteProjectApi(p.id)}
                onDuplicate={() => duplicateProjectApi(p.id)}
                onToggleFavorite={() => toggleFavorite(p.id)}
              />
            ))}
          </Section>
        )}

        {/* Recent */}
        <Section title="Recent" open={recentOpen} onToggle={() => setRecentOpen((o) => !o)}>
          {recent.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-600">No projects yet</p>
          ) : (
            recent.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                isActive={p.id === activeProjectId}
                onSwitch={() => switchProject(p.id)}
                onRename={(name) => renameProjectApi(p.id, name)}
                onDelete={() => deleteProjectApi(p.id)}
                onDuplicate={() => duplicateProjectApi(p.id)}
                onToggleFavorite={() => toggleFavorite(p.id)}
                showTime
              />
            ))
          )}
        </Section>

        {/* All projects */}
        <Section title="All Projects" open={allOpen} onToggle={() => setAllOpen((o) => !o)}>
          {allProjects.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-600">No projects yet</p>
          ) : (
            allProjects.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                isActive={p.id === activeProjectId}
                onSwitch={() => switchProject(p.id)}
                onRename={(name) => renameProjectApi(p.id, name)}
                onDelete={() => deleteProjectApi(p.id)}
                onDuplicate={() => duplicateProjectApi(p.id)}
                onToggleFavorite={() => toggleFavorite(p.id)}
                showTime
              />
            ))
          )}
        </Section>
      </nav>
    </aside>
  );
}

/* ─── Section ────────────────────────────────────────────────────── */

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {open && <ul className="mt-0.5 space-y-0.5">{children}</ul>}
    </section>
  );
}

/* ─── Project Item ───────────────────────────────────────────────── */

function ProjectItem({
  project,
  isActive,
  onSwitch,
  onRename,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  showTime,
}: {
  project: Project;
  isActive: boolean;
  onSwitch: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  showTime?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleRename = () => {
    const val = inputRef.current?.value.trim();
    if (val && val !== project.name) onRename(val);
    setEditing(false);
  };

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => { if (!editing) onSwitch(); }}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-colors",
          isActive
            ? "bg-violet-600/20 text-violet-300"
            : "hover:bg-gray-800 text-gray-400 hover:text-gray-200"
        )}
      >
        {project.isFavorite ? (
          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
        ) : (
          <FolderOpen className="w-3.5 h-3.5 opacity-50 shrink-0" />
        )}

        {editing ? (
          <input
            ref={inputRef}
            defaultValue={project.name}
            className="flex-1 bg-gray-800 text-gray-200 text-sm rounded px-1 py-0.5 outline-none ring-1 ring-violet-500 min-w-0"
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setEditing(false);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate">{project.name}</span>
        )}

        {showTime && !editing && (
          <span className="text-[10px] text-gray-600 shrink-0 hidden group-hover:hidden">
            {timeAgo(project.updatedAt)}
          </span>
        )}
      </button>

      {/* Context menu button (visible on hover) */}
      {!editing && (
        <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-opacity",
                menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              onClick={(e) => e.stopPropagation()}
              title="Project options"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-[200] w-40 py-1 rounded-lg bg-gray-800 border border-gray-700 shadow-xl"
              sideOffset={4}
              side="right"
              align="start"
            >
              <MenuBtn onClick={() => { setEditing(true); setMenuOpen(false); }}>
                <Pencil className="w-3.5 h-3.5" /> Rename
              </MenuBtn>
              <MenuBtn onClick={() => { onToggleFavorite(); setMenuOpen(false); }}>
                <Star className={cn("w-3.5 h-3.5", project.isFavorite && "text-yellow-500 fill-yellow-500")} />
                {project.isFavorite ? "Unfavorite" : "Favorite"}
              </MenuBtn>
              <MenuBtn onClick={() => { onDuplicate(); setMenuOpen(false); }}>
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </MenuBtn>
              <div className="h-px bg-gray-700 my-1" />
              <MenuBtn onClick={() => { onDelete(); setMenuOpen(false); }} danger>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </MenuBtn>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      )}
    </li>
  );
}

function MenuBtn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
        danger ? "text-red-400 hover:bg-red-900/30" : "text-gray-300 hover:bg-gray-700"
      )}
    >
      {children}
    </button>
  );
}
