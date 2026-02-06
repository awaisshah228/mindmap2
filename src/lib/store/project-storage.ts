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
import { applyNodesAndEdgesInChunks } from "@/lib/chunked-nodes";
import { parseStreamingDiagramBuffer } from "@/lib/ai/streaming-json-parser";

/** Module-level refs so loadProjectContentFromStream and saveNow can sync with auto-save. */
const lastSavedPayloadRef = { current: "" };
const lastPatchAtRef = { current: 0 };

/** Load one project's diagram from GET /api/projects/[id]?stream=1 and apply to canvas in chunks. */
async function loadProjectContentFromStream(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}?stream=1`, { credentials: "include" });
  if (!res.ok || !res.body) return;
  const { setNodes, setEdges, setNodeNote, setNodeTasks } = useCanvasStore.getState();
  const nodeIdMap = new Map<string, string>();
  let streamBuffer = "";
  let streamedNodeCount = 0;
  let streamedEdgeCount = 0;
  const processChunk = (delta: string) => {
    streamBuffer += delta;
    const parsed = parseStreamingDiagramBuffer(streamBuffer);
    for (let i = streamedNodeCount; i < parsed.nodes.length; i++) {
      const raw = parsed.nodes[i] as { id: string; type?: string; parentId?: string; [k: string]: unknown };
      if (raw.type === "group") continue;
      nodeIdMap.set(raw.id, raw.id);
      const node: Node = {
        id: raw.id,
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
    streamedNodeCount = parsed.nodes.length;
    for (let i = streamedEdgeCount; i < parsed.edges.length; i++) {
      const raw = parsed.edges[i] as { id?: string; source: string; target: string; [k: string]: unknown };
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
    streamedEdgeCount = parsed.edges.length;
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
    const data = JSON.parse(full.trim()) as {
      nodes?: unknown[];
      edges?: unknown[];
      nodeNotes?: Record<string, string>;
      nodeTasks?: Record<string, unknown>;
      nodeAttachments?: Record<string, unknown>;
      excalidrawData?: unknown;
      drawioData?: string | null;
    };
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
    applyNodesAndEdgesInChunks(setNodes, setEdges, flatNodes, validEdges);
    if (data.nodeNotes && typeof data.nodeNotes === "object") {
      Object.entries(data.nodeNotes).forEach(([id, note]) => setNodeNote(id, note));
    }
    if (data.nodeTasks && typeof data.nodeTasks === "object") {
      Object.entries(data.nodeTasks).forEach(([id, tasks]) => setNodeTasks(id, tasks as Project["nodeTasks"][string]));
    }
    if (data.nodeAttachments && typeof data.nodeAttachments === "object") {
      useCanvasStore.setState({ nodeAttachments: data.nodeAttachments as Project["nodeAttachments"] });
    }
    if (data.excalidrawData !== undefined) {
      useCanvasStore.getState().setExcalidrawData(data.excalidrawData ?? null);
    }
    if (data.drawioData !== undefined) {
      useCanvasStore.getState().setDrawioData(data.drawioData ?? null);
    }
    // Mark as "already saved" so save effect skips redundant PATCH right after load
    const s = useCanvasStore.getState();
    const active = s.projects.find((p) => p.id === projectId);
    const payload = {
      name: active?.name,
      nodes: s.nodes,
      edges: s.edges,
      viewport: active?.viewport,
      nodeNotes: s.nodeNotes,
      nodeTasks: s.nodeTasks,
      nodeAttachments: s.nodeAttachments,
      excalidrawData: s.excalidrawData ?? undefined,
      drawioData: s.drawioData ?? undefined,
    };
    lastSavedPayloadRef.current = JSON.stringify(payload);
  } catch {
    // keep streamed state if final parse fails
  }
}

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
      // Authenticated: fetch light list then stream active project for efficient loading
      fetch("/api/projects?metadataOnly=1", { credentials: "include" })
        .then((res) => (res.ok ? res.json() : []))
        .then((projects: Project[]) => {
          const list = Array.isArray(projects) ? projects : [];
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
              .then((r) => {
                if (!r.ok) throw new Error("Project create failed");
                return r.json();
              })
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
                  nodes: [],
                  edges: [],
                  nodeNotes: p.nodeNotes,
                  nodeTasks: p.nodeTasks,
                  nodeAttachments: p.nodeAttachments,
                  excalidrawData: (p as Project).excalidrawData ?? null,
                  drawioData: (p as Project).drawioData ?? null,
                  persistenceSource: "cloud",
                });
                const { setNodes, setEdges } = useCanvasStore.getState();
                applyNodesAndEdgesInChunks(setNodes, setEdges, p.nodes, p.edges);
              })
              .catch(() => {
                const localId = `proj-local-${now}-${Math.random().toString(36).slice(2, 9)}`;
                const localProj: Project = {
                  ...newProj,
                  id: localId,
                  createdAt: now,
                  updatedAt: now,
                };
                useCanvasStore.setState({
                  projects: [localProj],
                  activeProjectId: localId,
                  nodes: [],
                  edges: [],
                  nodeNotes: localProj.nodeNotes,
                  nodeTasks: localProj.nodeTasks,
                  nodeAttachments: localProj.nodeAttachments,
                  excalidrawData: localProj.excalidrawData ?? null,
                  drawioData: localProj.drawioData ?? null,
                  persistenceSource: "local",
                });
                saveProjects([localProj]);
                const { setNodes, setEdges } = useCanvasStore.getState();
                applyNodesAndEdgesInChunks(setNodes, setEdges, localProj.nodes, localProj.edges);
              });
            return;
          }
          const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
          const active = sorted[0];
          useCanvasStore.setState({
            projects: list,
            activeProjectId: active.id,
            nodes: [],
            edges: [],
            nodeNotes: active.nodeNotes,
            nodeTasks: active.nodeTasks,
            nodeAttachments: active.nodeAttachments,
            excalidrawData: active.excalidrawData ?? null,
            drawioData: active.drawioData ?? null,
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
            nodes: [],
            edges: [],
            nodeNotes: active.nodeNotes,
            nodeTasks: active.nodeTasks,
            nodeAttachments: active.nodeAttachments,
            excalidrawData: active.excalidrawData ?? null,
            drawioData: active.drawioData ?? null,
            persistenceSource: "local",
          });
          const { setNodes, setEdges } = useCanvasStore.getState();
          applyNodesAndEdgesInChunks(setNodes, setEdges, active.nodes, active.edges);
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
      nodes: [],
      edges: [],
      nodeNotes: active.nodeNotes,
      nodeTasks: active.nodeTasks,
      nodeAttachments: active.nodeAttachments,
      excalidrawData: active.excalidrawData ?? null,
      drawioData: active.drawioData ?? null,
      persistenceSource: "local",
    });
    const { setNodes, setEdges } = useCanvasStore.getState();
    applyNodesAndEdgesInChunks(setNodes, setEdges, active.nodes, active.edges);
  }, [sessionStatus, userId]);

  // When on cloud and active project has no diagram data (metadata-only list), stream load it once.
  const streamLoadedIds = useRef<Set<string>>(new Set());
  const persistenceSource = useCanvasStore((s) => s.persistenceSource);
  const activeProjectId = useCanvasStore((s) => s.activeProjectId);
  const projects = useCanvasStore((s) => s.projects);
  useEffect(() => {
    if (persistenceSource !== "cloud" || !activeProjectId || !isApiProjectId(activeProjectId)) return;
    if (streamLoadedIds.current.has(activeProjectId)) return;
    const active = projects.find((p) => p.id === activeProjectId);
    if (!active || (Array.isArray(active.nodes) && active.nodes.length > 0)) return;
    streamLoadedIds.current.add(activeProjectId);
    loadProjectContentFromStream(activeProjectId);
  }, [persistenceSource, activeProjectId, projects]);

  // Auto-save: frequent local updates, infrequent cloud PATCH. Only PATCH when data changed.
  const LOCAL_SAVE_DEBOUNCE_MS = 2000; // Update in-memory + localStorage every 2s after last change
  const CLOUD_PATCH_INTERVAL_MS = 30000; // PATCH to API at most every 30s
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastActiveProjectIdRef = useRef<string>("");
  const initialSave = useRef(true);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const nodeNotes = useCanvasStore((s) => s.nodeNotes);
  const nodeTasks = useCanvasStore((s) => s.nodeTasks);
  const nodeAttachments = useCanvasStore((s) => s.nodeAttachments);
  const excalidrawData = useCanvasStore((s) => s.excalidrawData);
  const drawioData = useCanvasStore((s) => s.drawioData);

  useEffect(() => {
    if (!hydrated.current) return;
    if (initialSave.current) {
      initialSave.current = false;
      return;
    }

    // Reset "saved" state when switching projects so we don't compare against wrong project
    const pid = activeProjectId ?? "";
    if (pid !== lastActiveProjectIdRef.current) {
      lastActiveProjectIdRef.current = pid;
      lastSavedPayloadRef.current = "";
    }

    useCanvasStore.setState({ hasUnsavedChanges: true });

    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const s = useCanvasStore.getState();
      const now = Date.now();
      const active = s.projects.find((p) => p.id === s.activeProjectId);
      const payload = {
        name: active?.name,
        nodes: s.nodes,
        edges: s.edges,
        viewport: active?.viewport,
        nodeNotes: s.nodeNotes,
        nodeTasks: s.nodeTasks,
        nodeAttachments: s.nodeAttachments,
        excalidrawData: s.excalidrawData ?? undefined,
        drawioData: s.drawioData ?? undefined,
      };
      const payloadStr = JSON.stringify(payload);

      // Skip entirely if nothing changed (no in-memory update, no PATCH)
      if (payloadStr === lastSavedPayloadRef.current) {
        useCanvasStore.setState({ hasUnsavedChanges: false });
        return;
      }

      const updatedProjects = s.projects.map((p) =>
        p.id === s.activeProjectId
          ? { ...p, nodes: s.nodes, edges: s.edges, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, excalidrawData: s.excalidrawData ?? undefined, drawioData: s.drawioData ?? undefined, updatedAt: now }
          : p
      );
      useCanvasStore.setState({ projects: updatedProjects, lastSavedAt: now, hasUnsavedChanges: false });
      lastSavedPayloadRef.current = payloadStr;

      if (s.persistenceSource === "cloud" && s.activeProjectId && isApiProjectId(s.activeProjectId)) {
        const elapsed = now - lastPatchAtRef.current;
        if (elapsed < CLOUD_PATCH_INTERVAL_MS) {
          // Reschedule PATCH after min interval; use fresh state when it runs
          const pid = s.activeProjectId;
          saveTimer.current = setTimeout(() => {
            const fresh = useCanvasStore.getState();
            if (fresh.activeProjectId !== pid) return; // Switched project
            const freshActive = fresh.projects.find((p) => p.id === pid);
            const freshPayload = {
              name: freshActive?.name,
              nodes: fresh.nodes,
              edges: fresh.edges,
              viewport: freshActive?.viewport,
              nodeNotes: fresh.nodeNotes,
              nodeTasks: fresh.nodeTasks,
              nodeAttachments: fresh.nodeAttachments,
              excalidrawData: fresh.excalidrawData ?? undefined,
              drawioData: fresh.drawioData ?? undefined,
            };
            const freshStr = JSON.stringify(freshPayload);
            if (freshStr === lastSavedPayloadRef.current) return;
            lastSavedPayloadRef.current = freshStr;
            lastPatchAtRef.current = Date.now();
            fetch(`/api/projects/${pid}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(freshPayload),
            })
              .then((r) => { if (!r.ok) throw new Error("Save failed"); })
              .catch(() => {
                useCanvasStore.setState({ persistenceSource: "local" });
                saveProjects(fresh.projects);
                lastSavedPayloadRef.current = "";
              });
          }, CLOUD_PATCH_INTERVAL_MS - elapsed);
          return;
        }
        lastPatchAtRef.current = now;
        fetch(`/api/projects/${s.activeProjectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
          .then((r) => { if (!r.ok) throw new Error("Save failed"); })
          .catch(() => {
            useCanvasStore.setState({ persistenceSource: "local" });
            saveProjects(updatedProjects);
            lastSavedPayloadRef.current = "";
          });
      } else {
        saveProjects(updatedProjects);
      }
    }, LOCAL_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, nodeNotes, nodeTasks, nodeAttachments, activeProjectId, persistenceSource, excalidrawData, drawioData]);

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
          ? { ...p, nodes: s.nodes, edges: s.edges, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, excalidrawData: s.excalidrawData ?? undefined, drawioData: s.drawioData ?? undefined, updatedAt: now }
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
          ? { ...p, nodes: s.nodes, edges: s.edges, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, excalidrawData: s.excalidrawData ?? undefined, drawioData: s.drawioData ?? undefined, updatedAt: now }
      : p
  );
  useCanvasStore.setState({ projects: updatedProjects, lastSavedAt: now, hasUnsavedChanges: false });

  if (s.persistenceSource === "cloud" && isApiProjectId(s.activeProjectId)) {
    const active = updatedProjects.find((x) => x.id === s.activeProjectId);
    const payload = {
      name: active?.name,
      nodes: s.nodes,
      edges: s.edges,
      viewport: active?.viewport,
      nodeNotes: s.nodeNotes,
      nodeTasks: s.nodeTasks,
      nodeAttachments: s.nodeAttachments,
      excalidrawData: s.excalidrawData ?? undefined,
      drawioData: s.drawioData ?? undefined,
    };
    fetch(`/api/projects/${s.activeProjectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Save failed");
        lastSavedPayloadRef.current = JSON.stringify(payload);
        lastPatchAtRef.current = now;
      })
      .catch(() => {
        useCanvasStore.setState({ persistenceSource: "local" });
        saveProjects(updatedProjects);
      });
  } else {
    lastSavedPayloadRef.current = JSON.stringify({
      name: updatedProjects.find((x) => x.id === s.activeProjectId)?.name,
      nodes: s.nodes,
      edges: s.edges,
      viewport: updatedProjects.find((x) => x.id === s.activeProjectId)?.viewport,
      nodeNotes: s.nodeNotes,
      nodeTasks: s.nodeTasks,
      nodeAttachments: s.nodeAttachments,
      excalidrawData: s.excalidrawData ?? undefined,
      drawioData: s.drawioData ?? undefined,
    });
    saveProjects(updatedProjects);
  }
}
