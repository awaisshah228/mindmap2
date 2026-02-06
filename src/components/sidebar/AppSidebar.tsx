"use client";

import { useState, useRef, useEffect, useMemo } from "react";
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
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { useCanvasStore, type Project } from "@/lib/store/canvas-store";

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

export default function AppSidebar({ isOpen = true, onClose, isMobile }: AppSidebarProps) {
  const projects = useCanvasStore((s) => s.projects);
  const activeProjectId = useCanvasStore((s) => s.activeProjectId);
  const createProject = useCanvasStore((s) => s.createProject);
  const switchProject = useCanvasStore((s) => s.switchProject);
  const renameProject = useCanvasStore((s) => s.renameProject);
  const deleteProject = useCanvasStore((s) => s.deleteProject);
  const duplicateProject = useCanvasStore((s) => s.duplicateProject);
  const toggleFavorite = useCanvasStore((s) => s.toggleFavorite);

  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [allOpen, setAllOpen] = useState(true);

  const favorites = useMemo(() => projects.filter((p) => p.isFavorite).sort((a, b) => b.updatedAt - a.updatedAt), [projects]);
  const recent = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5), [projects]);
  const allProjects = useMemo(() => [...projects].sort((a, b) => b.updatedAt - a.updatedAt), [projects]);

  const handleCreate = () => {
    createProject("Untitled");
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
        {/* Favorites */}
        {favorites.length > 0 && (
          <Section title="Favorites" open={favoritesOpen} onToggle={() => setFavoritesOpen((o) => !o)}>
            {favorites.map((p) => (
              <ProjectItem
                key={p.id}
                project={p}
                isActive={p.id === activeProjectId}
                onSwitch={() => switchProject(p.id)}
                onRename={(name) => renameProject(p.id, name)}
                onDelete={() => deleteProject(p.id)}
                onDuplicate={() => duplicateProject(p.id)}
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
                onRename={(name) => renameProject(p.id, name)}
                onDelete={() => deleteProject(p.id)}
                onDuplicate={() => duplicateProject(p.id)}
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
                onRename={(name) => renameProject(p.id, name)}
                onDelete={() => deleteProject(p.id)}
                onDuplicate={() => duplicateProject(p.id)}
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
