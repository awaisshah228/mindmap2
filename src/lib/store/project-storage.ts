"use client";

/**
 * Project persistence layer.
 *
 * Stores projects + settings to localStorage and auto-saves on state changes.
 * Also migrates legacy "ai-diagram-state-v1" data into a default project.
 */

import { useEffect, useRef } from "react";
import { useCanvasStore, type Project } from "./canvas-store";

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

// ─── React hook: hydrate on mount + auto-save ────────────────────────

export function useProjectPersistence() {
  const hydrated = useRef(false);

  // Hydrate from localStorage on first mount
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;

    const store = useCanvasStore.getState();

    // Load settings
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

    // Load projects
    let projects = loadProjects();

    // Migrate legacy single-diagram if no projects exist yet
    if (projects.length === 0) {
      const migrated = migrateLegacy();
      if (migrated) {
        projects = [migrated];
      }
    }

    if (projects.length === 0) {
      // Create a default project
      const now = Date.now();
      projects = [{
        id: `proj-default-${now}`,
        name: "Untitled",
        createdAt: now,
        updatedAt: now,
        isFavorite: false,
        nodes: [],
        edges: [],
        nodeNotes: {},
        nodeTasks: {},
        nodeAttachments: {},
      }];
    }

    // Load the most recently updated project
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
    });
  }, []);

  // Auto-save canvas data on change (debounced).
  // NOTE: We intentionally do NOT watch `projects` here — the save itself
  // updates the projects array in the store, and watching it would create
  // an infinite save loop.
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialSave = useRef(true); // skip marking dirty on first render after hydration
  const activeProjectId = useCanvasStore((s) => s.activeProjectId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const nodeNotes = useCanvasStore((s) => s.nodeNotes);
  const nodeTasks = useCanvasStore((s) => s.nodeTasks);
  const nodeAttachments = useCanvasStore((s) => s.nodeAttachments);

  useEffect(() => {
    if (!hydrated.current) return;

    // Skip the very first run (hydration populates these values, that's not a user change)
    if (initialSave.current) {
      initialSave.current = false;
      return;
    }

    // Mark as dirty immediately so the UI shows "Unsaved changes"
    useCanvasStore.setState({ hasUnsavedChanges: true });

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      // Save current canvas state into the active project entry
      const s = useCanvasStore.getState();
      const now = Date.now();
      const updatedProjects = s.projects.map((p) =>
        p.id === s.activeProjectId
          ? { ...p, nodes: s.nodes, edges: s.edges, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, updatedAt: now }
          : p
      );
      useCanvasStore.setState({ projects: updatedProjects, lastSavedAt: now, hasUnsavedChanges: false });
      saveProjects(updatedProjects);
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, nodeNotes, nodeTasks, nodeAttachments, activeProjectId]);

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

  // Force-save before the page unloads (prevents data loss during the debounce window)
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
      // Use synchronous localStorage write (no setState needed since page is closing)
      saveProjects(updatedProjects);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);
}

/**
 * Immediately save the active project to localStorage (manual save / Ctrl+S).
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
  saveProjects(updatedProjects);
}
