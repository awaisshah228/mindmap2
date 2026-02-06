"use client";

/**
 * Project persistence layer.
 *
 * - When authenticated: load/save projects via API (Postgres); settings still in localStorage.
 * - When not authenticated: load/save projects to localStorage.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useCanvasStore, DEFAULT_MIND_MAP_LAYOUT, type Project } from "./canvas-store";
import type { Node, Edge } from "@xyflow/react";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isApiProjectId(id: string) {
  return UUID_REGEX.test(id);
}

const PROJECTS_KEY = "ai-diagram-projects-v1";
const SETTINGS_KEY = "ai-diagram-settings-v1";
const LEGACY_KEY = "ai-diagram-state-v1";

// ─── Raw localStorage helpers ────────────────────────────────────────

function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // quota exceeded — best effort
  }
}

interface PersistedSettings {
  theme?: string;
  llmProvider?: string;
  llmModel?: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  aiPrompts?: unknown[];
  dailyNotes?: Record<string, string>;
}

function loadSettings(): PersistedSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedSettings;
  } catch {
    return {};
  }
}

function saveSettings(s: PersistedSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // best effort
  }
}

// ─── Migration from legacy single-diagram store ──────────────────────

function migrateLegacy(): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { nodes?: unknown[]; edges?: unknown[] };
    if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) return null;

    const now = Date.now();
    const project: Project = {
      id: `proj-migrated-${now}`,
      name: "Untitled",
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      nodes: parsed.nodes as Project["nodes"],
      edges: (parsed.edges ?? []) as Project["edges"],
      nodeNotes: {},
      nodeTasks: {},
      nodeAttachments: {},
    };

    // Remove legacy key so migration doesn't repeat
    window.localStorage.removeItem(LEGACY_KEY);
    return project;
  } catch {
    return null;
  }
}

// ─── Default mind-map template for brand-new projects ─────────────────

const MIND_MAP_NODE_WIDTH = 170;
const INITIAL_CANVAS_PADDING = 100;

function getDefaultMindMapTemplate(): { nodes: Node[]; edges: Edge[] } {
  const { spacingX, spacingY } = DEFAULT_MIND_MAP_LAYOUT;
  const pad = INITIAL_CANVAS_PADDING;
  const layer1X = pad + MIND_MAP_NODE_WIDTH + spacingX;
  const layer2X = layer1X + MIND_MAP_NODE_WIDTH + spacingX;

  const nodes: Node[] = [
    { id: "mind-root", type: "mindMap", position: { x: pad, y: pad }, data: { label: "Mind Map Overview" } },
    { id: "mind-goals", type: "mindMap", position: { x: layer1X, y: pad - spacingY }, data: { label: "Goals" } },
    { id: "mind-tasks", type: "mindMap", position: { x: layer1X, y: pad }, data: { label: "Key Tasks" } },
    { id: "mind-stakeholders", type: "mindMap", position: { x: layer1X, y: pad + spacingY }, data: { label: "Stakeholders" } },
    { id: "mind-task-ideas", type: "mindMap", position: { x: layer2X, y: pad - spacingY }, data: { label: "Milestones" } },
    { id: "mind-task-next", type: "mindMap", position: { x: layer2X, y: pad + spacingY }, data: { label: "Next Actions" } },
  ];

  const edgeBase = { type: "labeledConnector" as const, data: { connectorType: "default" } };
  const edges: Edge[] = [
    { id: "edge-root-goals", source: "mind-root", target: "mind-goals", sourceHandle: "right", targetHandle: "left", ...edgeBase },
    { id: "edge-root-tasks", source: "mind-root", target: "mind-tasks", sourceHandle: "right", targetHandle: "left", ...edgeBase },
    { id: "edge-root-stakeholders", source: "mind-root", target: "mind-stakeholders", sourceHandle: "right", targetHandle: "left", ...edgeBase },
    { id: "edge-goals-ideas", source: "mind-goals", target: "mind-task-ideas", sourceHandle: "right", targetHandle: "left", ...edgeBase },
    { id: "edge-stakeholders-next", source: "mind-stakeholders", target: "mind-task-next", sourceHandle: "right", targetHandle: "left", ...edgeBase },
  ];

  return { nodes, edges };
}

// ─── React hook: hydrate on mount + auto-save ────────────────────────

export function useProjectPersistence() {
  const hydrated = useRef(false);
  const { isSignedIn, userId } = useAuth();
  const sessionStatus = isSignedIn === undefined ? "loading" : isSignedIn ? "authenticated" : "unauthenticated";
  const sessionUser = isSignedIn && userId ? { id: userId } : null;

  // Hydrate once we know session status (authenticated → API, else localStorage)
  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (hydrated.current) return;
    hydrated.current = true;

    const store = useCanvasStore.getState();

    // Load settings (always from localStorage)
    const settings = loadSettings();
    if (settings.theme) store.setTheme(settings.theme as "light" | "dark" | "system");
    if (settings.llmProvider) store.setLLMProvider(settings.llmProvider as typeof store.llmProvider);
    if (settings.llmModel) store.setLLMModel(settings.llmModel);
    if (settings.llmApiKey) store.setLLMApiKey(settings.llmApiKey);
    if (settings.llmBaseUrl) store.setLLMBaseUrl(settings.llmBaseUrl);
    if (settings.aiPrompts) store.setAIPrompts(settings.aiPrompts as typeof store.aiPrompts);
    if (settings.dailyNotes) {
      Object.entries(settings.dailyNotes).forEach(([date, note]) => {
        store.setDailyNote(date, note);
      });
    }

    if (sessionUser) {
      // Authenticated: fetch projects from API
      fetch("/api/projects", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : []))
        .then((projects: Project[]) => {
          let list = Array.isArray(projects) ? projects : [];
          if (list.length === 0) {
            const now = Date.now();
            const template = getDefaultMindMapTemplate();
            const newProj = {
              id: "", // will be set by POST response
              name: "Untitled",
              createdAt: now,
              updatedAt: now,
              isFavorite: false,
              nodes: template.nodes as Project["nodes"],
              edges: template.edges as Project["edges"],
              nodeNotes: {} as Record<string, string>,
              nodeTasks: {} as Record<string, Project["nodeTasks"][string]>,
              nodeAttachments: {} as Record<string, Project["nodeAttachments"][string]>,
            };
            fetch("/api/projects", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                name: newProj.name,
                nodes: newProj.nodes,
                edges: newProj.edges,
                nodeNotes: newProj.nodeNotes,
                nodeTasks: newProj.nodeTasks,
                nodeAttachments: newProj.nodeAttachments,
              }),
            })
              .then((r) => r.json())
              .then((created) => {
                const p: Project = {
                  ...newProj,
                  id: created.id,
                  createdAt: created.createdAt ?? now,
                  updatedAt: created.updatedAt ?? now,
                };
                useCanvasStore.setState({
                  projects: [p],
                  activeProjectId: p.id,
                  nodes: p.nodes,
                  edges: p.edges,
                  nodeNotes: p.nodeNotes,
                  nodeTasks: p.nodeTasks,
                  nodeAttachments: p.nodeAttachments,
                  persistenceSource: "cloud",
                });
              })
              .catch(() => {
                useCanvasStore.setState({
                  projects: [newProj],
                  activeProjectId: newProj.id,
                  nodes: newProj.nodes,
                  edges: newProj.edges,
                  nodeNotes: newProj.nodeNotes,
                  nodeTasks: newProj.nodeTasks,
                  nodeAttachments: newProj.nodeAttachments,
                  persistenceSource: "local",
                });
              });
            return;
          }
          const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
          const active = sorted[0];
          useCanvasStore.setState({
            projects: list,
            activeProjectId: active.id,
            nodes: active.nodes,
            edges: active.edges,
            nodeNotes: active.nodeNotes,
            nodeTasks: active.nodeTasks,
            nodeAttachments: active.nodeAttachments,
            persistenceSource: "cloud",
          });
        })
        .catch(() => {
          // Fallback to local
          let projects = loadProjects();
          if (projects.length === 0) {
            const migrated = migrateLegacy();
            if (migrated) projects = [migrated];
          }
          if (projects.length === 0) {
            const now = Date.now();
            const template = getDefaultMindMapTemplate();
            projects = [{
              id: `proj-default-${now}`,
              name: "Untitled",
              createdAt: now,
              updatedAt: now,
              isFavorite: false,
              nodes: template.nodes as Project["nodes"],
              edges: template.edges as Project["edges"],
              nodeNotes: {},
              nodeTasks: {},
              nodeAttachments: {},
            }];
          }
          const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
          const active = sorted[0];
          useCanvasStore.setState({
            projects,
            activeProjectId: active.id,
            nodes: active.nodes,
            edges: active.edges,
            nodeNotes: active.nodeNotes,
            nodeTasks: active.nodeTasks,
            nodeAttachments: active.nodeAttachments,
            persistenceSource: "local",
          });
        });
      return;
    }

    // Not authenticated: load from localStorage
    let projects = loadProjects();
    if (projects.length === 0) {
      const migrated = migrateLegacy();
      if (migrated) projects = [migrated];
    }
    if (projects.length === 0) {
      const now = Date.now();
      const template = getDefaultMindMapTemplate();
      projects = [{
        id: `proj-default-${now}`,
        name: "Untitled",
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        nodes: template.nodes as Project["nodes"],
        edges: template.edges as Project["edges"],
        nodeNotes: {},
        nodeTasks: {},
        nodeAttachments: {},
      }];
    }
    const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
    const active = sorted[0];
    useCanvasStore.setState({
      projects,
      activeProjectId: active.id,
      nodes: active.nodes,
      edges: active.edges,
      nodeNotes: active.nodeNotes,
      nodeTasks: active.nodeTasks,
      nodeAttachments: active.nodeAttachments,
      persistenceSource: "local",
    });
  }, [sessionStatus, userId]);

  // Auto-save canvas data on change (debounced).
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialSave = useRef(true);
  const persistenceSource = useCanvasStore((s) => s.persistenceSource);
  const activeProjectId = useCanvasStore((s) => s.activeProjectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const nodeNotes = useCanvasStore((s) => s.nodeNotes);
  const nodeTasks = useCanvasStore((s) => s.nodeTasks);
  const nodeAttachments = useCanvasStore((s) => s.nodeAttachments);

  useEffect(() => {
    if (!hydrated.current) return;
    if (initialSave.current) {
      initialSave.current = false;
      return;
    }

    useCanvasStore.setState({ hasUnsavedChanges: true });

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const s = useCanvasStore.getState();
      const now = Date.now();
      const updatedProjects = s.projects.map((p) =>
        p.id === s.activeProjectId
          ? { ...p, nodes: s.nodes, edges: s.edges, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, updatedAt: now }
          : p
      );
      useCanvasStore.setState({ projects: updatedProjects, lastSavedAt: now, hasUnsavedChanges: false });

      if (s.persistenceSource === "cloud" && s.activeProjectId && isApiProjectId(s.activeProjectId)) {
        const active = updatedProjects.find((x) => x.id === s.activeProjectId);
        fetch(`/api/projects/${s.activeProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: active?.name,
            nodes: s.nodes,
            edges: s.edges,
            viewport: active?.viewport,
            nodeNotes: s.nodeNotes,
            nodeTasks: s.nodeTasks,
            nodeAttachments: s.nodeAttachments,
          }),
        }).catch(() => {});
      } else {
        saveProjects(updatedProjects);
      }
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, nodeNotes, nodeTasks, nodeAttachments, activeProjectId, persistenceSource]);

  // Auto-save settings on change
  const theme = useCanvasStore((s) => s.theme);
  const llmProvider = useCanvasStore((s) => s.llmProvider);
  const llmModel = useCanvasStore((s) => s.llmModel);
  const llmApiKey = useCanvasStore((s) => s.llmApiKey);
  const llmBaseUrl = useCanvasStore((s) => s.llmBaseUrl);
  const aiPrompts = useCanvasStore((s) => s.aiPrompts);
  const dailyNotes = useCanvasStore((s) => s.dailyNotes);

  useEffect(() => {
    if (!hydrated.current) return;
    saveSettings({ theme, llmProvider, llmModel, llmApiKey, llmBaseUrl, aiPrompts, dailyNotes });
  }, [theme, llmProvider, llmModel, llmApiKey, llmBaseUrl, aiPrompts, dailyNotes]);

  // Force-save before the page unloads (localStorage only; cloud relies on debounced save)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const s = useCanvasStore.getState();
      if (!s.activeProjectId || !s.hasUnsavedChanges) return;
      const now = Date.now();
      const updatedProjects = s.projects.map((p) =>
        p.id === s.activeProjectId
          ? { ...p, nodes: s.nodes, edges: s.edges, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, updatedAt: now }
          : p
      );
      saveProjects(updatedProjects);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}

/**
 * Immediately save the active project (localStorage or API when authenticated).
 * Can be called from anywhere without needing React context.
 */
export function saveNow() {
  const s = useCanvasStore.getState();
  if (!s.activeProjectId) return;
  const now = Date.now();
  const updatedProjects = s.projects.map((p) =>
    p.id === s.activeProjectId
      ? { ...p, nodes: s.nodes, edges: s.edges, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, updatedAt: now }
      : p
  );
  useCanvasStore.setState({ projects: updatedProjects, lastSavedAt: now, hasUnsavedChanges: false });

  if (s.persistenceSource === "cloud" && isApiProjectId(s.activeProjectId)) {
    const active = updatedProjects.find((x) => x.id === s.activeProjectId);
    fetch(`/api/projects/${s.activeProjectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: active?.name,
        nodes: s.nodes,
        edges: s.edges,
        viewport: active?.viewport,
        nodeNotes: s.nodeNotes,
        nodeTasks: s.nodeTasks,
        nodeAttachments: s.nodeAttachments,
      }),
    }).catch(() => {});
  } else {
    saveProjects(updatedProjects);
  }
}
