"use client";

/**
 * Project persistence layer.
 *
 * - When authenticated: load/save projects via API (Postgres); settings still in localStorage.
 * - When not authenticated: load/save projects to localStorage.
 */

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useCanvasStore, type Project, type SavedLayout, type ExcalidrawScene } from "./canvas-store";
import type { Node, Edge } from "@xyflow/react";
import { applyNodesAndEdgesInChunks } from "@/lib/chunked-nodes";
import {
  fitGroupBoundsAndCenterChildren,
  ensureExtentForGroupedNodes,
  normalizeMindMapEdgeHandles,
  type LayoutDirection,
} from "@/lib/layout-engine";
import { parseStreamingDiagramBuffer } from "@/lib/ai/streaming-json-parser";

/** Module-level refs so loadProjectContentFromStream and saveNow can sync with auto-save. */
const lastSavedPayloadRef = { current: "" };
const lastPatchAtRef = { current: 0 };

const STREAM_NODE_THRESHOLD = 100; // Use stream API only when project has >= 100 nodes; use regular GET for smaller projects

/** Apply loaded project data to store in chunks (shared by regular GET and stream). Waits for chunks to finish before resolving. */
async function applyLoadedProjectData(
  projectId: string,
  data: {
    nodes?: unknown[];
    edges?: unknown[];
    savedLayout?: { direction: string; algorithm: string; spacingX: number; spacingY: number };
    nodeNotes?: Record<string, string>;
    nodeTasks?: Record<string, unknown>;
    nodeAttachments?: Record<string, unknown>;
    excalidrawData?: unknown;
    drawioData?: string | null;
  },
  opts?: { fromCloud?: boolean }
): Promise<void> {
  const { setNodes, setEdges, setNodeNote, setNodeTasks } = useCanvasStore.getState();
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];
  const rawNodes = nodes as { id: string; type?: string; position?: { x: number; y: number }; data?: Record<string, unknown>; parentId?: string; style?: Record<string, unknown> }[];
  const flatNodes = rawNodes
    .map((n) => ({
      id: n.id,
      type: (n.type as string) || "rectangle",
      position: n.position ?? { x: 0, y: 0 },
      data: n.data ?? {},
      ...(n.style && { style: n.style }),
      ...(n.parentId && { parentId: n.parentId, extent: "parent" as const }),
    })) as Node[];
  const nodeIds = new Set(flatNodes.map((n) => n.id));
  // Strip parentId from nodes whose parent doesn't exist (avoids React Flow "parent.measured undefined" crash)
  const safeNodes = flatNodes.map((n) => {
    if (n.parentId && !nodeIds.has(n.parentId)) {
      const { parentId, extent, ...rest } = n;
      void parentId;
      void extent;
      return rest as Node;
    }
    return n;
  });
  // Apply same grouping logic as AI diagram page: ensure extent and fit group bounds to children
  let processedNodes = ensureExtentForGroupedNodes(safeNodes);
  if (processedNodes.some((n) => n.type === "group")) {
    processedNodes = fitGroupBoundsAndCenterChildren(processedNodes);
  }

  const validNodeIds = new Set(processedNodes.map((n) => n.id));
  type RawEdge = { id?: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; data?: Record<string, unknown> };
  let validEdges = (edges as RawEdge[])
    .filter((e) => e && validNodeIds.has(e.source) && validNodeIds.has(e.target))
    .map((e, i) => ({
      id: e.id || `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      ...(e.data && { data: e.data }),
    })) as Edge[];

  // Same logic as AI generation: normalize edge handles based on node positions when missing
  const nodeById = new Map(processedNodes.map((n) => [n.id, n]));
  validEdges = validEdges.map((e) => {
    let sourceHandle = e.sourceHandle;
    let targetHandle = e.targetHandle;
    const sourceNode = nodeById.get(e.source);
    const targetNode = nodeById.get(e.target);
    if (sourceNode && targetNode && (!sourceHandle || !targetHandle)) {
      const sx = sourceNode.position?.x ?? 0;
      const sy = sourceNode.position?.y ?? 0;
      const tx = targetNode.position?.x ?? 0;
      const ty = targetNode.position?.y ?? 0;
      const dx = tx - sx;
      const dy = ty - sy;
      if (Math.abs(dx) >= Math.abs(dy)) {
        sourceHandle = sourceHandle ?? (dx >= 0 ? "right" : "left");
        targetHandle = targetHandle ?? (dx >= 0 ? "left" : "right");
      } else {
        sourceHandle = sourceHandle ?? (dy >= 0 ? "bottom" : "top");
        targetHandle = targetHandle ?? (dy >= 0 ? "top" : "bottom");
      }
    }
    return { ...e, sourceHandle, targetHandle };
  });

  // Same logic as AI generation: for mind map diagrams, normalize handles by direction + use labeledConnector
  const isMindMapDiagram =
    processedNodes.length > 0 &&
    processedNodes.every((n) => n.type === "mindMap");
  if (isMindMapDiagram) {
    const savedLayout = data.savedLayout;
    const mindMapLayout = useCanvasStore.getState().mindMapLayout;
    const direction: LayoutDirection =
      (savedLayout?.direction as LayoutDirection) ?? mindMapLayout?.direction ?? "LR";
    validEdges = normalizeMindMapEdgeHandles(processedNodes, validEdges, direction);
    validEdges = validEdges.map((edge) => {
      const srcNode = processedNodes.find((n) => n.id === edge.source);
      const tgtNode = processedNodes.find((n) => n.id === edge.target);
      const isMindMapEdge = srcNode?.type === "mindMap" && tgtNode?.type === "mindMap";
      return {
        ...edge,
        type: isMindMapEdge ? "labeledConnector" : edge.type,
        data: { ...edge.data, connectorType: "default" } as Record<string, unknown>,
      };
    }) as Edge[];
  }

  await applyNodesAndEdgesInChunks(setNodes, setEdges, processedNodes, validEdges);
  useCanvasStore.getState().setPendingFitView(true);
  useCanvasStore.getState().setPendingFitViewNodeIds(processedNodes.map((n) => n.id));
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
    const scene = data.excalidrawData == null ? null : (data.excalidrawData as ExcalidrawScene);
    useCanvasStore.getState().setExcalidrawData(scene);
  }
  if (data.drawioData !== undefined) {
    useCanvasStore.getState().setDrawioData(data.drawioData ?? null);
  }
  if (data.savedLayout != null) {
    const layout = data.savedLayout as SavedLayout;
    useCanvasStore.setState((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId ? { ...p, savedLayout: layout } : p
      ),
    }));
  }
  useCanvasStore.setState((s) => ({
    projects: s.projects.map((p) =>
      p.id === projectId ? { ...p, nodes: processedNodes, edges: validEdges } : p
    ),
  }));
  const s = useCanvasStore.getState();
  const active = s.projects.find((p) => p.id === projectId);
  if (opts?.fromCloud !== false) s.setLastSyncedToCloudAt(Date.now());
  lastSavedPayloadRef.current = JSON.stringify({
    name: active?.name,
    nodes: s.nodes,
    edges: s.edges,
    viewport: active?.viewport,
    nodeNotes: s.nodeNotes,
    nodeTasks: s.nodeTasks,
    nodeAttachments: s.nodeAttachments,
    excalidrawData: s.excalidrawData ?? undefined,
    drawioData: s.drawioData ?? undefined,
  });
}

/** Load project via regular GET (for small projects < 50 nodes). */
async function loadProjectContentRegular(projectId: string): Promise<void> {
  const res = await fetch(`/api/projects/${projectId}`, { credentials: "include" });
  if (!res.ok) return;
  const data = await res.json();
  await applyLoadedProjectData(projectId, data, { fromCloud: true });
  const proj = useCanvasStore.getState().projects.find((p) => p.id === projectId);
  if (proj && (Array.isArray(proj.nodes) ? proj.nodes.length > 0 : false)) setCachedProject(proj);
}

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
      const raw = parsed.nodes[i] as { id: string; type?: string; parentId?: string; style?: Record<string, unknown>; [k: string]: unknown };
      nodeIdMap.set(raw.id, raw.id);
      const node: Node = {
        id: raw.id,
        type: (raw.type as string) || "rectangle",
        position: (raw.position as { x: number; y: number }) ?? { x: 0, y: 0 },
        data: (raw.data as Record<string, unknown>) ?? {},
        ...(raw.style && { style: raw.style }),
        ...(raw.parentId && nodeIdMap.has(raw.parentId as string) && { parentId: raw.parentId as string, extent: "parent" as const }),
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
    const data = JSON.parse(full.trim()) as Parameters<typeof applyLoadedProjectData>[1];
    await applyLoadedProjectData(projectId, data, { fromCloud: true });
    const proj = useCanvasStore.getState().projects.find((p) => p.id === projectId);
    if (proj && (Array.isArray(proj.nodes) ? proj.nodes.length > 0 : false)) setCachedProject(proj);
  } catch {
    // keep streamed state if final parse fails
  }
}

/** Load project content: regular GET if < 50 nodes, stream if >= 50. Called only when opening a project for the first time. */
async function loadProjectContent(projectId: string, nodeCount: number): Promise<void> {
  if (nodeCount >= STREAM_NODE_THRESHOLD) {
    await loadProjectContentFromStream(projectId);
  } else {
    await loadProjectContentRegular(projectId);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isApiProjectId(id: string) {
  return UUID_REGEX.test(id);
}

const PROJECTS_KEY = "ai-diagram-projects-v1";
const PROJECT_CACHE_KEY = "ai-diagram-project-cache-v1";
const MAX_CACHED_PROJECTS = 100;
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

/** Project content cache (for localStorage-first loading). Keyed by project ID; evicts oldest when over limit. */
function getCachedProject(projectId: string): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROJECT_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as Record<string, { project: Project; updatedAt: number }>;
    const entry = cache[projectId];
    return entry?.project ?? null;
  } catch {
    return null;
  }
}

function setCachedProject(project: Project) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PROJECT_CACHE_KEY);
    const cache: Record<string, { project: Project; updatedAt: number }> = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    cache[project.id] = { project: { ...project, updatedAt: now }, updatedAt: now };

    const entries = Object.entries(cache);
    if (entries.length > MAX_CACHED_PROJECTS) {
      const sorted = [...entries].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
      const toRemove = sorted.length - MAX_CACHED_PROJECTS;
      for (let i = 0; i < toRemove; i++) delete cache[sorted[i]![0]];
    }
    window.localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // best effort
  }
}

function removeCachedProject(projectId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(PROJECT_CACHE_KEY);
    if (!raw) return;
    const cache = JSON.parse(raw) as Record<string, { project: Project; updatedAt: number }>;
    delete cache[projectId];
    window.localStorage.setItem(PROJECT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // best effort
  }
}

interface PersistedSettings {
  theme?: string;
  llmProvider?: string;
  llmModel?: string;
  llmApiKey?: string;
  llmBaseUrl?: string;
  cloudModelId?: string | null;
  aiPrompts?: unknown[];
  dailyNotes?: Record<string, string>;
  applyLayoutAtStart?: boolean;
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

/** Hardcoded initial mind map: nodes and edges used for new projects / default template. */
function getDefaultMindMapTemplate(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    { id: "mind-root", type: "mindMap", position: { x: 80, y: 148 }, data: { label: "Mind Map Overview" } },
    { id: "mind-goals", type: "mindMap", position: { x: 464.5, y: 20 }, data: { label: "Goals" } },
    { id: "mind-tasks", type: "mindMap", position: { x: 451, y: 150 }, data: { label: "Key Tasks" } },
    { id: "mind-stakeholders", type: "mindMap", position: { x: 442, y: 276 }, data: { label: "Stakeholders" } },
    { id: "mind-task-ideas", type: "mindMap", position: { x: 767.5, y: 22 }, data: { label: "Milestones" } },
    { id: "mind-task-next", type: "mindMap", position: { x: 762, y: 278 }, data: { label: "Next Actions" } },
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
    if (settings.cloudModelId != null) store.setCloudModelId(settings.cloudModelId);
    if (settings.aiPrompts) store.setAIPrompts(settings.aiPrompts as typeof store.aiPrompts);
    if (typeof settings.applyLayoutAtStart === "boolean") store.setApplyLayoutAtStart(settings.applyLayoutAtStart);
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
                saveProjects([p]);
                setCachedProject(p);
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

  // When on cloud and active project has no diagram data (metadata-only list), load from localStorage cache first; only call API on cache miss.
  const loadedProjectIds = useRef<Set<string>>(new Set());
  const persistenceSource = useCanvasStore((s) => s.persistenceSource);
  const activeProjectId = useCanvasStore((s) => s.activeProjectId);
  const projects = useCanvasStore((s) => s.projects);
  useEffect(() => {
    if (persistenceSource !== "cloud" || !activeProjectId || !isApiProjectId(activeProjectId)) return;
    if (loadedProjectIds.current.has(activeProjectId)) return;
    const active = projects.find((p) => p.id === activeProjectId);
    if (!active || (Array.isArray(active.nodes) && active.nodes.length > 0)) return;
    loadedProjectIds.current.add(activeProjectId);
    const cached = getCachedProject(activeProjectId);
    const hasCachedContent =
      cached &&
      ((Array.isArray(cached.nodes) && cached.nodes.length > 0) || !!cached.drawioData || !!cached.excalidrawData);
    if (hasCachedContent && cached) {
      applyLoadedProjectData(activeProjectId, cached, { fromCloud: false });
      return;
    }
    const nodeCount = active.nodeCount ?? (Array.isArray(active.nodes) ? active.nodes.length : 0);
    loadProjectContent(activeProjectId, nodeCount);
  }, [persistenceSource, activeProjectId, projects]);

  // Auto-save: localStorage only (larger interval to reduce writes). API PATCH only on manual Ctrl+S.
  const LOCAL_SAVE_DEBOUNCE_MS = 8000; // Update in-memory + localStorage every 8s after last change
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
        savedLayout: active?.savedLayout,
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

      // Auto-save writes only to localStorage (reduce server cost). API PATCH happens only on manual Ctrl+S.
      saveProjects(updatedProjects);
      const activeProj = updatedProjects.find((p) => p.id === s.activeProjectId);
      if (
        activeProj &&
        ((Array.isArray(activeProj.nodes) && activeProj.nodes.length > 0) || activeProj.drawioData || activeProj.excalidrawData)
      )
        setCachedProject(activeProj);
    }, LOCAL_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, nodeNotes, nodeTasks, nodeAttachments, activeProjectId, persistenceSource, excalidrawData, drawioData]);

  // Auto-save settings on change
  const theme = useCanvasStore((s) => s.theme);
  const llmProvider = useCanvasStore((s) => s.llmProvider);
  const llmModel = useCanvasStore((s) => s.llmModel);
  const llmApiKey = useCanvasStore((s) => s.llmApiKey);
  const llmBaseUrl = useCanvasStore((s) => s.llmBaseUrl);
  const cloudModelId = useCanvasStore((s) => s.cloudModelId);
  const aiPrompts = useCanvasStore((s) => s.aiPrompts);
  const dailyNotes = useCanvasStore((s) => s.dailyNotes);
  const applyLayoutAtStart = useCanvasStore((s) => s.applyLayoutAtStart);

  useEffect(() => {
    if (!hydrated.current) return;
    saveSettings({ theme, llmProvider, llmModel, llmApiKey, llmBaseUrl, cloudModelId, aiPrompts, dailyNotes, applyLayoutAtStart });
  }, [theme, llmProvider, llmModel, llmApiKey, llmBaseUrl, cloudModelId, aiPrompts, dailyNotes, applyLayoutAtStart]);

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
          ? { ...p, nodes: s.nodes, edges: s.edges, savedLayout: p.savedLayout, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, excalidrawData: s.excalidrawData ?? undefined, drawioData: s.drawioData ?? undefined, updatedAt: now }
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
      savedLayout: active?.savedLayout,
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
        useCanvasStore.getState().setLastSyncedToCloudAt(now);
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
      savedLayout: updatedProjects.find((x) => x.id === s.activeProjectId)?.savedLayout,
      nodeNotes: s.nodeNotes,
      nodeTasks: s.nodeTasks,
      nodeAttachments: s.nodeAttachments,
      excalidrawData: s.excalidrawData ?? undefined,
      drawioData: s.drawioData ?? undefined,
    });
    saveProjects(updatedProjects);
  }
  const activeProj = updatedProjects.find((x) => x.id === s.activeProjectId);
  if (activeProj) setCachedProject(activeProj);
}

/** Record a prompt + diagram to history (project + diagram level). Only for API projects. */
export function recordPromptHistory(opts: {
  prompt: string;
  nodes?: object[];
  edges?: object[];
  targetCanvas?: "reactflow" | "excalidraw" | "drawio";
}): void {
  const s = useCanvasStore.getState();
  if (!s.activeProjectId || !isApiProjectId(s.activeProjectId) || s.persistenceSource !== "cloud") return;
  const nodes = opts.nodes ?? [];
  const edges = opts.edges ?? [];
  const nodeCount = Array.isArray(nodes) ? nodes.length : 0;
  const edgeCount = Array.isArray(edges) ? edges.length : 0;
  fetch(`/api/projects/${s.activeProjectId}/prompt-history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      prompt: opts.prompt.trim(),
      nodes,
      edges,
      targetCanvas: opts.targetCanvas ?? "reactflow",
      nodeCount,
      edgeCount,
    }),
  }).catch(() => {});
}

// ─── API-aware CRUD for authenticated users (syncs API + localStorage) ───

/** Create project: POST to API when authenticated or in cloud mode, else local only. Updates store + localStorage. */
export async function createProjectApi(isAuthenticated: boolean, name: string): Promise<string> {
  const store = useCanvasStore.getState();
  const shouldUseApi = isAuthenticated || store.persistenceSource === "cloud";
  if (shouldUseApi) {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          nodes: [],
          edges: [],
          nodeNotes: {},
          nodeTasks: {},
          nodeAttachments: {},
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      const created = (await res.json()) as { id: string; name?: string; createdAt?: number; updatedAt?: number };
      const now = Date.now();
      const p: Project = {
        id: created.id,
        name: created.name ?? name,
        createdAt: created.createdAt ?? now,
        updatedAt: created.updatedAt ?? now,
        isFavorite: false,
        nodes: [],
        edges: [],
        nodeNotes: {},
        nodeTasks: {},
        nodeAttachments: {},
      };
      const nextProjects = [p, ...store.projects];
      useCanvasStore.setState({
        projects: nextProjects,
        activeProjectId: p.id,
        nodes: [],
        edges: [],
        nodeNotes: {},
        nodeTasks: {},
        nodeAttachments: {},
        excalidrawData: null,
        drawioData: null,
        persistenceSource: "cloud",
      });
      const { setNodes, setEdges } = useCanvasStore.getState();
      applyNodesAndEdgesInChunks(setNodes, setEdges, p.nodes, p.edges);
      saveProjects(nextProjects);
      setCachedProject(p);
      return p.id;
    } catch {
      // API failed — fall through to local
    }
  }
  const id = store.createProject(name);
  const nextProjects = useCanvasStore.getState().projects;
  saveProjects(nextProjects);
  const proj = nextProjects.find((x) => x.id === id);
  if (proj) setCachedProject(proj);
  return id;
}

/** Rename project: PATCH API when authenticated + API project, else local only. Updates store + localStorage. */
export async function renameProjectApi(projectId: string, name: string): Promise<void> {
  const s = useCanvasStore.getState();
  if (s.persistenceSource === "cloud" && isApiProjectId(projectId)) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Rename failed");
    } catch {
      // Proceed with local update on API failure
    }
  }
  useCanvasStore.setState((state) => ({
    projects: state.projects.map((p) => (p.id === projectId ? { ...p, name, updatedAt: Date.now() } : p)),
  }));
  const nextProjects = useCanvasStore.getState().projects;
  saveProjects(nextProjects);
  const proj = nextProjects.find((p) => p.id === projectId);
  if (proj) setCachedProject(proj);
}

/** Delete project: DELETE API when authenticated + API project, else local only. Updates store + localStorage. */
export async function deleteProjectApi(projectId: string): Promise<void> {
  const s = useCanvasStore.getState();
  if (s.persistenceSource === "cloud" && isApiProjectId(projectId)) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      // Proceed with local delete on API failure
    }
  }
  removeCachedProject(projectId);
  const remaining = s.projects.filter((p) => p.id !== projectId);
  if (s.activeProjectId === projectId) {
    const next = remaining[0];
    if (next) {
      useCanvasStore.setState({
        projects: remaining,
        activeProjectId: next.id,
        nodes: next.nodes,
        edges: next.edges,
        nodeNotes: next.nodeNotes,
        nodeTasks: next.nodeTasks,
        nodeAttachments: next.nodeAttachments,
        excalidrawData: next.excalidrawData ?? null,
        drawioData: next.drawioData ?? null,
      });
      const { setNodes, setEdges } = useCanvasStore.getState();
      applyNodesAndEdgesInChunks(setNodes, setEdges, next.nodes, next.edges);
    } else {
      useCanvasStore.setState({
        projects: remaining,
        activeProjectId: null,
        nodes: [],
        edges: [],
        nodeNotes: {},
        nodeTasks: {},
        nodeAttachments: {},
        excalidrawData: null,
        drawioData: null,
      });
    }
  } else {
    useCanvasStore.setState({ projects: remaining });
  }
  saveProjects(remaining);
}

/** Duplicate project: POST to API when authenticated + API project, else local only. Updates store + localStorage. */
export async function duplicateProjectApi(projectId: string): Promise<void> {
  const s = useCanvasStore.getState();
  const src = s.projects.find((p) => p.id === projectId);
  if (!src) return;
  const dupContent = {
    name: `${src.name} (copy)`,
    nodes: JSON.parse(JSON.stringify(src.nodes)),
    edges: JSON.parse(JSON.stringify(src.edges)),
    nodeNotes: { ...src.nodeNotes },
    nodeTasks: JSON.parse(JSON.stringify(src.nodeTasks)),
    nodeAttachments: { ...src.nodeAttachments },
    excalidrawData: src.excalidrawData ?? undefined,
    drawioData: src.drawioData ?? undefined,
  };
  if (s.persistenceSource === "cloud" && isApiProjectId(projectId)) {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(dupContent),
      });
      if (!res.ok) throw new Error("Duplicate failed");
      const created = (await res.json()) as { id: string; name?: string; createdAt?: number; updatedAt?: number };
      const now = Date.now();
      const p: Project = {
        id: created.id,
        name: created.name ?? dupContent.name,
        createdAt: created.createdAt ?? now,
        updatedAt: created.updatedAt ?? now,
        isFavorite: false,
        nodes: dupContent.nodes,
        edges: dupContent.edges,
        nodeNotes: dupContent.nodeNotes,
        nodeTasks: dupContent.nodeTasks,
        nodeAttachments: dupContent.nodeAttachments,
        excalidrawData: dupContent.excalidrawData,
        drawioData: dupContent.drawioData,
      };
      const nextProjects = [p, ...s.projects];
      useCanvasStore.setState({
        projects: nextProjects,
        activeProjectId: p.id,
        nodes: p.nodes,
        edges: p.edges,
        nodeNotes: p.nodeNotes,
        nodeTasks: p.nodeTasks,
        nodeAttachments: p.nodeAttachments,
        excalidrawData: p.excalidrawData ?? null,
        drawioData: p.drawioData ?? null,
      });
      const { setNodes, setEdges } = useCanvasStore.getState();
      applyNodesAndEdgesInChunks(setNodes, setEdges, p.nodes, p.edges);
      saveProjects(nextProjects);
      setCachedProject(p);
      useCanvasStore.getState().setPendingFitView(true);
      useCanvasStore.getState().setPendingFitViewNodeIds(null);
      return;
    } catch {
      // Fallback to local
    }
  }
  s.duplicateProject(projectId);
  const nextProjects = useCanvasStore.getState().projects;
  saveProjects(nextProjects);
  const dup = nextProjects[0];
  if (dup) setCachedProject(dup);
}
