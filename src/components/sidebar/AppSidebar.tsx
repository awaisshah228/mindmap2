"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
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
import { applyNodesAndEdgesInChunks } from "@/lib/chunked-nodes";
import { parseStreamingDiagramBuffer } from "@/lib/ai/streaming-json-parser";
import { getLayoutedElements } from "@/lib/layout-engine";
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

  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [allOpen, setAllOpen] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    fetch("/api/presets?templates=true")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: TemplateItem[]) => setTemplates(Array.isArray(list) ? list : []))
      .catch(() => setTemplates([]));
  }, []);

  const loadTemplate = async (template: TemplateItem) => {
    const { id, label } = template;
    setTemplatesLoading(true);
    try {
      const res = await fetch(`/api/diagrams/preset/stream?preset=${encodeURIComponent(id)}`, {
        credentials: "include",
      });
      if (!res.ok || !res.body) {
        setTemplatesLoading(false);
        return;
      }
      if (!activeProjectId) await createProjectApi(!!isSignedIn || persistenceSource === "cloud", label || "From template");
      const nodeIdMap = new Map<string, string>();
      let streamBuffer = "";
      let streamedNodeCount = 0;
      let streamedEdgeCount = 0;
      const processChunk = (delta: string) => {
        streamBuffer += delta;
        const res = parseStreamingDiagramBuffer(streamBuffer);
        for (let i = streamedNodeCount; i < res.nodes.length; i++) {
          const raw = res.nodes[i] as { id: string; type?: string; parentId?: string; [k: string]: unknown };
          if (raw.type === "group") continue;
          const nid = raw.id;
          nodeIdMap.set(nid, nid);
          const node: Node = {
            id: nid,
            type: (raw.type as string) || "rectangle",
            position: (raw.position as { x: number; y: number }) ?? { x: 0, y: 0 },
            data: (raw.data as Record<string, unknown>) ?? {},
            ...(raw.parentId && { parentId: raw.parentId as string, extent: "parent" as const }),
          };
          if (streamedNodeCount === 0 && i === 0) {
            setNodes([node]);
            setEdges([]);
          } else {
            setNodes((prev) => (prev.some((n) => n.id === node.id) ? prev : [...prev, node]));
          }
        }
        streamedNodeCount = res.nodes.length;
        for (let i = streamedEdgeCount; i < res.edges.length; i++) {
          const raw = res.edges[i] as { id?: string; source: string; target: string; [k: string]: unknown };
          const source = nodeIdMap.get(raw.source) ?? raw.source;
          const target = nodeIdMap.get(raw.target) ?? raw.target;
          const edge: Edge = {
            id: (raw.id as string) || `e-${source}-${target}-${i}`,
            source,
            target,
            ...(raw.data != null && typeof raw.data === "object" && !Array.isArray(raw.data)
              ? { data: raw.data as Record<string, unknown> }
              : {}),
          };
          setEdges((prev) => (prev.some((e) => e.id === edge.id) ? prev : [...prev, edge]));
        }
        streamedEdgeCount = res.edges.length;
      };
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          full += chunk;
          processChunk(chunk);
        }
      }
      try {
        const data = JSON.parse(full.trim()) as { nodes?: unknown[]; edges?: unknown[]; layoutDirection?: string };
        const nodes = Array.isArray(data.nodes) ? data.nodes : [];
        const edges = Array.isArray(data.edges) ? data.edges : [];
        const flatNodes = (nodes as { id: string; type?: string; position?: { x: number; y: number }; data?: Record<string, unknown>; parentId?: string }[])
          .filter((n) => n.type !== "group")
          .map((n) => ({
            id: n.id,
            type: (n.type as string) || "rectangle",
            position: n.position ?? { x: 0, y: 0 },
            data: n.data ?? {},
            ...(n.parentId && { parentId: n.parentId, extent: "parent" as const }),
          })) as Node[];
        const nodeIds = new Set(flatNodes.map((n) => n.id));
        const validEdges = (edges as { id?: string; source: string; target: string; data?: Record<string, unknown> }[])
          .filter((e) => e && nodeIds.has(e.source) && nodeIds.has(e.target))
          .map((e, i) => ({
            id: e.id || `e-${e.source}-${e.target}-${i}`,
            source: e.source,
            target: e.target,
            ...(e.data && { data: e.data }),
          })) as Edge[];
        const direction = data.layoutDirection === "vertical" ? ("TB" as const) : ("LR" as const);
        const layoutResult = await getLayoutedElements(
          flatNodes,
          validEdges,
          direction,
          [160, 120],
          "elk-layered"
        );
        await applyNodesAndEdgesInChunks(setNodes, setEdges, layoutResult.nodes, layoutResult.edges);
        setHasUnsavedChanges(true);
        saveNow();
        setPendingFitView(true);
        setPendingFitViewNodeIds(layoutResult.nodes.map((n) => n.id));
      } catch {
        // keep streamed state if final parse fails
      }
      onClose?.();
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

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
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
