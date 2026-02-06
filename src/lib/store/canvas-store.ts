import { type Node, type Edge } from "@xyflow/react";
import { create } from "zustand";
import type { LayoutDirection, LayoutAlgorithm } from "@/lib/layout-engine";
import type { ShapeType } from "@/lib/shape-types";
import { applyNodesAndEdgesInChunks } from "@/lib/chunked-nodes";

export type MindMapLayoutOptions = {
  algorithm: LayoutAlgorithm;
  direction: LayoutDirection;
  spacingX: number;
  spacingY: number;
};

export const DEFAULT_MIND_MAP_LAYOUT: MindMapLayoutOptions = {
  algorithm: "elk-mrtree",
  direction: "LR",
  spacingX: 80,
  spacingY: 60,
};

export type NodeType =
  | "stickyNote"
  | "rectangle"
  | "diamond"
  | "circle"
  | "document"
  | "text"
  | "mindMap"
  | "frame"
  | "list"
  | "freeDraw"
  | "icon"
  | "image"
  | "databaseSchema"
  | "service"
  | "queue"
  | "actor"
  | "group";

export type Tool = NodeType | "connector" | "pan" | "select" | "selection" | "move" | "emoji" | "eraser" | "ai";

/** Edge connector type for new edges (Bezier, Straight, Smooth step). */
export type PendingEdgeType = "default" | "straight" | "smoothstep";

/** Theme options */
export type ThemeMode = "light" | "dark" | "system";

/** Task item for a node */
export interface NodeTask {
  id: string;
  text: string;
  done: boolean;
}

/** Attachment for a node */
export interface NodeAttachment {
  id: string;
  name: string;
  url: string;
  type: string; // mime type
}

/** Custom AI prompt template */
export interface AIPromptTemplate {
  id: string;
  label: string;
  prompt: string;
}

/** LLM provider options */
export type LLMProvider = "openai" | "openrouter" | "anthropic" | "google" | "custom";

export interface LLMModel {
  id: string;
  label: string;
  provider: LLMProvider;
}

export const LLM_MODELS: LLMModel[] = [
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "openai" },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai" },
  { id: "o3-mini", label: "O3 Mini", provider: "openai" },
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", provider: "anthropic" },
  { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google" },
  { id: "gemini-2.5-pro-preview-06-05", label: "Gemini 2.5 Pro", provider: "google" },
];

/** Excalidraw scene saved with the project (when canvas mode is or was Excalidraw). */
export interface ExcalidrawScene {
  elements: unknown[];
  appState?: Record<string, unknown>;
  /** Binary files (images) referenced by image elements. */
  files?: Record<string, { mimeType: string; id: string; dataURL: string }>;
}

/** A saved project (diagram + metadata) */
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  isFavorite: boolean;
  nodes: Node[];
  edges: Edge[];
  nodeNotes: Record<string, string>;
  nodeTasks: Record<string, NodeTask[]>;
  nodeAttachments: Record<string, NodeAttachment[]>;
  viewport?: { x: number; y: number; zoom: number };
  /** When set, Excalidraw canvas has content; load when switching to Excalidraw mode. */
  excalidrawData?: ExcalidrawScene | null;
  /** Draw.io diagram XML; load when switching to Draw.io mode. */
  drawioData?: string | null;
}

export const DEFAULT_AI_PROMPTS: AIPromptTemplate[] = [
  { id: "generate-branch", label: "Generate branch", prompt: "Generate child topics and sub-branches for this node: \"{label}\". Return 4-6 relevant children." },
  { id: "generate-questions", label: "Generate questions", prompt: "Generate thought-provoking questions about: \"{label}\". Return 4-6 questions as child nodes." },
  { id: "expand-ideas", label: "Expand ideas", prompt: "Expand and elaborate on the idea: \"{label}\". Break it down into detailed sub-topics." },
  { id: "summarize", label: "Summarize branch", prompt: "Summarize all the nodes in this branch into a concise overview." },
  { id: "pros-cons", label: "Pros & Cons", prompt: "List the pros and cons of: \"{label}\". Create two branches: Pros and Cons." },
];

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  hoveredNodeId: string | null;
  activeTool: Tool;
  pendingShape: ShapeType | null;
  pendingEmoji: string | null;
  pendingIconId: string | null;
  /** Optional label for the next icon/emoji placed (click or drag). */
  pendingIconLabel: string | null;
  /** Custom icon data URL (uploaded image used as icon). */
  pendingCustomIcon: string | null;
  /** When set, next canvas click adds an image node with this URL and optional label. */
  pendingImageUrl: string | null;
  pendingImageLabel: string | null;
  /** Connector type for newly drawn edges when connector tool is used. */
  pendingEdgeType: PendingEdgeType;
  mindMapLayout: MindMapLayoutOptions;
  undoStack: { nodes: Node[]; edges: Edge[] }[];
  redoStack: { nodes: Node[]; edges: Edge[] }[];

  /** When true, the canvas should call fitView on the next render (e.g. after AI adds a diagram). */
  pendingFitView: boolean;
  /** When set, fitView will focus on these node IDs only (e.g. newly added AI nodes). */
  pendingFitViewNodeIds: string[] | null;
  /** When true, run auto layout once after nodes are rendered (e.g. after AI adds a diagram), same as first-time canvas open. */
  pendingApplyLayout: boolean;

  /** Last AI prompt used to generate/update the diagram (for refinement). */
  lastAIPrompt: string | null;
  /** Last AI-generated diagram (nodes + edges) stored for refinement context. */
  lastAIDiagram: { nodes: Node[]; edges: Edge[] } | null;

  /** When set, the node with this id should focus its main label for editing (toolbar "Edit text" button). */
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;

  // ─── Notemap-inspired features ───────────────────────────────────

  /** Rich notes stored per node id */
  nodeNotes: Record<string, string>;
  /** Tasks stored per node id */
  nodeTasks: Record<string, NodeTask[]>;
  /** Attachments stored per node id */
  nodeAttachments: Record<string, NodeAttachment[]>;

  /** Node id whose details panel is open (notes/tasks/attachments) */
  detailsPanelNodeId: string | null;

  /** Canvas mode: "reactflow" | "excalidraw" | "drawio" */
  canvasMode: "reactflow" | "excalidraw" | "drawio";
  setCanvasMode: (mode: "reactflow" | "excalidraw" | "drawio") => void;

  /** Presentation mode */
  presentationMode: boolean;
  presentationNodeIndex: number;
  /** Custom node order for presentation (array of node IDs). Empty = default order. */
  presentationOrder: string[];
  /** Whether the presentation flow editor panel is open */
  presentationEditorOpen: boolean;

  /** Search */
  searchOpen: boolean;
  searchQuery: string;

  /** Theme */
  theme: ThemeMode;

  /** React Flow canvas background: dots, lines, cross, or none */
  canvasBackgroundVariant: "dots" | "lines" | "cross" | "none";
  setCanvasBackgroundVariant: (v: "dots" | "lines" | "cross" | "none") => void;

  /** Focus mode — only show this node's branch */
  focusedBranchNodeId: string | null;

  /** Keyboard shortcuts panel */
  shortcutsOpen: boolean;

  /** Settings panel */
  settingsOpen: boolean;
  settingsInitialTab: string | null;

  /** Daily notes */
  dailyNotes: Record<string, string>; // key = YYYY-MM-DD
  dailyNotesOpen: boolean;

  /** AI sidebar — opens on editor without routing */
  aiSidebarOpen: boolean;
  aiSidebarContext: { mode?: string; nodeId?: string; label?: string; prompt?: string } | null;
  setAISidebarOpen: (open: boolean, context?: { mode?: string; nodeId?: string; label?: string; prompt?: string }) => void;

  /** Configurable AI prompts */
  aiPrompts: AIPromptTemplate[];

  /** LLM Configuration */
  llmProvider: LLMProvider;
  llmModel: string; // model id
  llmApiKey: string; // user-supplied API key (stored in browser only)
  llmBaseUrl: string; // custom base URL for "custom" provider

  // ─── Save status ───────────────────────────────────────────────────
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean;
  setLastSavedAt: (ts: number) => void;
  setHasUnsavedChanges: (v: boolean) => void;
  /** When true, bottom bar Save button shows "Save layout" (set after Layout all/selection). */
  showSaveLayoutLabel: boolean;
  setShowSaveLayoutLabel: (v: boolean) => void;

  // ─── Projects ──────────────────────────────────────────────────────
  projects: Project[];
  activeProjectId: string | null;
  /** Set by persistence layer: "local" (localStorage) or "cloud" (API). */
  persistenceSource: "local" | "cloud";
  setPersistenceSource: (source: "local" | "cloud") => void;
  /** Current Excalidraw scene (for active project); syncs to project on save / switch. */
  excalidrawData: ExcalidrawScene | null;
  setExcalidrawData: (data: ExcalidrawScene | null) => void;
  /** Draw.io diagram XML (for active project); syncs to project on save / switch. */
  drawioData: string | null;
  setDrawioData: (data: string | null) => void;

  createProject: (name: string) => string;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  switchProject: (id: string) => void;
  toggleFavorite: (id: string) => void;
  /** Persist current canvas state into the active project. */
  saveCurrentProject: () => void;

  // ─── Notemap actions ─────────────────────────────────────────────

  setNodeNote: (nodeId: string, note: string) => void;
  setNodeTasks: (nodeId: string, tasks: NodeTask[]) => void;
  addNodeTask: (nodeId: string, task: NodeTask) => void;
  toggleNodeTask: (nodeId: string, taskId: string) => void;
  removeNodeTask: (nodeId: string, taskId: string) => void;
  setNodeAttachments: (nodeId: string, attachments: NodeAttachment[]) => void;
  addNodeAttachment: (nodeId: string, attachment: NodeAttachment) => void;
  removeNodeAttachment: (nodeId: string, attachmentId: string) => void;

  setDetailsPanelNodeId: (id: string | null) => void;

  setPresentationMode: (active: boolean) => void;
  setPresentationNodeIndex: (index: number) => void;
  setPresentationOrder: (order: string[]) => void;
  setPresentationEditorOpen: (open: boolean) => void;

  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;

  setTheme: (theme: ThemeMode) => void;

  setFocusedBranchNodeId: (id: string | null) => void;

  setShortcutsOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean, initialTab?: string) => void;

  setDailyNote: (date: string, note: string) => void;
  setDailyNotesOpen: (open: boolean) => void;

  setAIPrompts: (prompts: AIPromptTemplate[]) => void;

  setLLMProvider: (provider: LLMProvider) => void;
  setLLMModel: (model: string) => void;
  setLLMApiKey: (key: string) => void;
  setLLMBaseUrl: (url: string) => void;

  // ─── Existing actions ────────────────────────────────────────────

  setHoveredNodeId: (id: string | null) => void;
  setMindMapLayout: (options: Partial<MindMapLayoutOptions>) => void;
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedEdgeIds: (ids: string[]) => void;
  setActiveTool: (tool: Tool) => void;
  setPendingShape: (shape: ShapeType | null) => void;
  setPendingEmoji: (emoji: string | null) => void;
  setPendingIconId: (id: string | null) => void;
  setPendingIconLabel: (label: string | null) => void;
  setPendingCustomIcon: (dataUrl: string | null) => void;
  setPendingImage: (url: string | null, label?: string | null) => void;
  setPendingEdgeType: (type: PendingEdgeType) => void;
  setPendingFitView: (value: boolean) => void;
  setPendingFitViewNodeIds: (ids: string[] | null) => void;
  setPendingApplyLayout: (value: boolean) => void;
  setLastAIPrompt: (prompt: string | null) => void;
  setLastAIDiagram: (diagram: { nodes: Node[]; edges: Edge[] } | null) => void;
  addNode: (node: Node) => void;
  addNodes: (nodes: Node[]) => void;
  addEdge: (edge: Edge) => void;
  addEdges: (edges: Edge[]) => void;
  removeNodes: (ids: string[]) => void;
  removeEdges: (ids: string[]) => void;
  updateNode: (id: string, data: Record<string, unknown>) => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  selectedEdgeIds: [],
  hoveredNodeId: null,
  activeTool: "select",
  pendingShape: null,
  pendingEmoji: null,
  pendingIconId: null,
  pendingIconLabel: null,
  pendingCustomIcon: null,
  pendingImageUrl: null,
  pendingImageLabel: null,
  pendingEdgeType: "default",
  mindMapLayout: DEFAULT_MIND_MAP_LAYOUT,
  undoStack: [],
  redoStack: [],
  pendingFitView: false,
  pendingFitViewNodeIds: null,
  pendingApplyLayout: false,
  lastAIPrompt: null,
  lastAIDiagram: null,
  editingNodeId: null,

  // ─── Notemap feature state ───────────────────────────────────────
  nodeNotes: {},
  nodeTasks: {},
  nodeAttachments: {},
  detailsPanelNodeId: null,
  canvasMode: "reactflow" as const,
  setCanvasMode: (mode) => set({ canvasMode: mode }),

  presentationMode: false,
  presentationNodeIndex: 0,
  presentationOrder: [],
  presentationEditorOpen: false,
  searchOpen: false,
  searchQuery: "",
  theme: "light",
  canvasBackgroundVariant: "dots",
  focusedBranchNodeId: null,
  shortcutsOpen: false,
  settingsOpen: false,
  settingsInitialTab: null,
  dailyNotes: {},
  dailyNotesOpen: false,
  aiSidebarOpen: false,
  aiSidebarContext: null as { mode?: string; nodeId?: string; label?: string; prompt?: string } | null,
  setAISidebarOpen: (open, context) =>
    set({ aiSidebarOpen: open, aiSidebarContext: open && context ? context : null }),
  aiPrompts: DEFAULT_AI_PROMPTS,
  llmProvider: "openrouter" as LLMProvider,
  llmModel: "openai/gpt-4o-mini",
  llmApiKey: "",
  llmBaseUrl: "",

  // ─── Save status ───────────────────────────────────────────────────
  lastSavedAt: null,
  hasUnsavedChanges: false,
  setLastSavedAt: (ts) => set({ lastSavedAt: ts }),
  setHasUnsavedChanges: (v) => set({ hasUnsavedChanges: v }),
  showSaveLayoutLabel: false,
  setShowSaveLayoutLabel: (v) => set({ showSaveLayoutLabel: v }),

  // ─── Projects ──────────────────────────────────────────────────────
  projects: [],
  activeProjectId: null,
  persistenceSource: "local",
  setPersistenceSource: (source) => set({ persistenceSource: source }),
  excalidrawData: null,
  setExcalidrawData: (data) => set({ excalidrawData: data }),
  drawioData: null,
  setDrawioData: (data) => set({ drawioData: data }),

  createProject: (name) => {
    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const project: Project = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      nodes: [],
      edges: [],
      nodeNotes: {},
      nodeTasks: {},
      nodeAttachments: {},
    };
    set((s) => ({ projects: [project, ...s.projects], activeProjectId: id, nodes: [], edges: [], nodeNotes: {}, nodeTasks: {}, nodeAttachments: {}, excalidrawData: null, drawioData: null }));
    return id;
  },

  deleteProject: (id) => {
    const s = get();
    const remaining = s.projects.filter((p) => p.id !== id);
    if (s.activeProjectId === id) {
      const next = remaining[0];
      if (next) {
        set({
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
      } else {
        set({ projects: remaining, activeProjectId: null, nodes: [], edges: [], nodeNotes: {}, nodeTasks: {}, nodeAttachments: {}, excalidrawData: null, drawioData: null });
      }
    } else {
      set({ projects: remaining });
    }
  },

  duplicateProject: (id) => {
    const s = get();
    const src = s.projects.find((p) => p.id === id);
    if (!src) return;
    const newId = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const dup: Project = {
      ...src,
      id: newId,
      name: `${src.name} (copy)`,
      createdAt: now,
      updatedAt: now,
      isFavorite: false,
      nodes: JSON.parse(JSON.stringify(src.nodes)),
      edges: JSON.parse(JSON.stringify(src.edges)),
      nodeNotes: { ...src.nodeNotes },
      nodeTasks: JSON.parse(JSON.stringify(src.nodeTasks)),
      nodeAttachments: JSON.parse(JSON.stringify(src.nodeAttachments)),
      excalidrawData: src.excalidrawData ? JSON.parse(JSON.stringify(src.excalidrawData)) : undefined,
      drawioData: src.drawioData ?? undefined,
    };
    set((s2) => ({ projects: [dup, ...s2.projects] }));
  },

  renameProject: (id, name) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)),
    })),

  switchProject: (id) => {
    const s = get();
    // Save current project first
    if (s.activeProjectId) {
      const updated = s.projects.map((p) =>
        p.id === s.activeProjectId
          ? { ...p, nodes: s.nodes, edges: s.edges, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, excalidrawData: s.excalidrawData ?? undefined, drawioData: s.drawioData ?? undefined, updatedAt: Date.now() }
          : p
      );
      const target = updated.find((p) => p.id === id);
      if (target) {
        set({
          projects: updated,
          activeProjectId: id,
          nodes: [],
          edges: [],
          nodeNotes: target.nodeNotes,
          nodeTasks: target.nodeTasks,
          nodeAttachments: target.nodeAttachments,
          excalidrawData: target.excalidrawData ?? null,
          drawioData: target.drawioData ?? null,
          undoStack: [],
          redoStack: [],
        });
        applyNodesAndEdgesInChunks(get().setNodes, get().setEdges, target.nodes, target.edges);
        get().setPendingFitView(true);
        get().setPendingFitViewNodeIds(null);
      }
    } else {
      const target = s.projects.find((p) => p.id === id);
      if (target) {
        set({
          activeProjectId: id,
          nodes: [],
          edges: [],
          nodeNotes: target.nodeNotes,
          nodeTasks: target.nodeTasks,
          nodeAttachments: target.nodeAttachments,
          excalidrawData: target.excalidrawData ?? null,
          drawioData: target.drawioData ?? null,
          undoStack: [],
          redoStack: [],
        });
        applyNodesAndEdgesInChunks(get().setNodes, get().setEdges, target.nodes, target.edges);
        get().setPendingFitView(true);
        get().setPendingFitViewNodeIds(null);
      }
    }
  },

  toggleFavorite: (id) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, isFavorite: !p.isFavorite } : p)),
    })),

  saveCurrentProject: () => {
    const s = get();
    if (!s.activeProjectId) return;
    set({
      projects: s.projects.map((p) =>
        p.id === s.activeProjectId
          ? { ...p, nodes: s.nodes, edges: s.edges, nodeNotes: s.nodeNotes, nodeTasks: s.nodeTasks, nodeAttachments: s.nodeAttachments, excalidrawData: s.excalidrawData ?? undefined, drawioData: s.drawioData ?? undefined, updatedAt: Date.now() }
          : p
      ),
    });
  },

  // ─── Notemap actions ─────────────────────────────────────────────
  setNodeNote: (nodeId, note) =>
    set((s) => ({ nodeNotes: { ...s.nodeNotes, [nodeId]: note } })),

  setNodeTasks: (nodeId, tasks) =>
    set((s) => ({ nodeTasks: { ...s.nodeTasks, [nodeId]: tasks } })),

  addNodeTask: (nodeId, task) =>
    set((s) => ({
      nodeTasks: {
        ...s.nodeTasks,
        [nodeId]: [...(s.nodeTasks[nodeId] ?? []), task],
      },
    })),

  toggleNodeTask: (nodeId, taskId) =>
    set((s) => ({
      nodeTasks: {
        ...s.nodeTasks,
        [nodeId]: (s.nodeTasks[nodeId] ?? []).map((t) =>
          t.id === taskId ? { ...t, done: !t.done } : t
        ),
      },
    })),

  removeNodeTask: (nodeId, taskId) =>
    set((s) => ({
      nodeTasks: {
        ...s.nodeTasks,
        [nodeId]: (s.nodeTasks[nodeId] ?? []).filter((t) => t.id !== taskId),
      },
    })),

  setNodeAttachments: (nodeId, attachments) =>
    set((s) => ({ nodeAttachments: { ...s.nodeAttachments, [nodeId]: attachments } })),

  addNodeAttachment: (nodeId, attachment) =>
    set((s) => ({
      nodeAttachments: {
        ...s.nodeAttachments,
        [nodeId]: [...(s.nodeAttachments[nodeId] ?? []), attachment],
      },
    })),

  removeNodeAttachment: (nodeId, attachmentId) =>
    set((s) => ({
      nodeAttachments: {
        ...s.nodeAttachments,
        [nodeId]: (s.nodeAttachments[nodeId] ?? []).filter((a) => a.id !== attachmentId),
      },
    })),

  setDetailsPanelNodeId: (id) => set({ detailsPanelNodeId: id }),

  setPresentationMode: (active) => set({ presentationMode: active, presentationNodeIndex: 0 }),
  setPresentationNodeIndex: (index) => set({ presentationNodeIndex: index }),
  setPresentationOrder: (order) => set({ presentationOrder: order }),
  setPresentationEditorOpen: (open) => set({ presentationEditorOpen: open }),

  setSearchOpen: (open) => set({ searchOpen: open, searchQuery: open ? get().searchQuery : "" }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  setTheme: (theme) => set({ theme }),
  setCanvasBackgroundVariant: (v) => set({ canvasBackgroundVariant: v }),

  setFocusedBranchNodeId: (id) => set({ focusedBranchNodeId: id }),

  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setSettingsOpen: (open, initialTab) => set({ settingsOpen: open, settingsInitialTab: initialTab ?? null }),

  setDailyNote: (date, note) =>
    set((s) => ({ dailyNotes: { ...s.dailyNotes, [date]: note } })),
  setDailyNotesOpen: (open) => set({ dailyNotesOpen: open }),

  setAIPrompts: (prompts) => set({ aiPrompts: prompts }),

  setLLMProvider: (provider) => set({ llmProvider: provider }),
  setLLMModel: (model) => set({ llmModel: model }),
  setLLMApiKey: (key) => set({ llmApiKey: key }),
  setLLMBaseUrl: (url) => set({ llmBaseUrl: url }),

  // ─── Existing actions ────────────────────────────────────────────
  setEditingNodeId: (id) => set({ editingNodeId: id }),
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),
  setMindMapLayout: (options) =>
    set((s) => ({
      mindMapLayout: { ...s.mindMapLayout, ...options },
    })),
  setNodes: (nodesOrFn) =>
    set((state) => ({
      nodes:
        typeof nodesOrFn === "function" ? nodesOrFn(state.nodes) : nodesOrFn,
    })),

  setEdges: (edgesOrFn) =>
    set((state) => ({
      edges:
        typeof edgesOrFn === "function" ? edgesOrFn(state.edges) : edgesOrFn,
    })),

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids }),
  setSelectedEdgeIds: (ids) => set({ selectedEdgeIds: ids }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setPendingShape: (shape) => set({ pendingShape: shape }),
  setPendingEmoji: (emoji) => set({ pendingEmoji: emoji }),
  setPendingIconId: (id) => set({ pendingIconId: id }),
  setPendingIconLabel: (label) => set({ pendingIconLabel: label }),
  setPendingCustomIcon: (dataUrl) => set({ pendingCustomIcon: dataUrl }),
  setPendingImage: (url, label) =>
    set({ pendingImageUrl: url ?? null, pendingImageLabel: label ?? null }),
  setPendingEdgeType: (type) => set({ pendingEdgeType: type }),
  setPendingFitView: (value) => set({ pendingFitView: value }),
  setPendingFitViewNodeIds: (ids) => set({ pendingFitViewNodeIds: ids }),
  setPendingApplyLayout: (value: boolean) => set({ pendingApplyLayout: value }),
  setLastAIPrompt: (prompt) => set({ lastAIPrompt: prompt }),
  setLastAIDiagram: (diagram) => set({ lastAIDiagram: diagram }),

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  addNodes: (nodes) =>
    set((state) => {
      const byId = new Map(state.nodes.map((n) => [n.id, n]));
      nodes.forEach((n) => byId.set(n.id, n));
      return { nodes: Array.from(byId.values()) };
    }),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges.filter((e) => e.id !== edge.id), edge],
    })),

  addEdges: (edges) =>
    set((state) => {
      const byId = new Map(state.edges.map((e) => [e.id, e]));
      edges.forEach((e) => byId.set(e.id, e));
      return { edges: Array.from(byId.values()) };
    }),

  removeNodes: (ids) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => !ids.includes(n.id)),
      edges: state.edges.filter(
        (e) => !ids.includes(e.source) && !ids.includes(e.target)
      ),
    })),

  removeEdges: (ids) =>
    set((state) => ({
      edges: state.edges.filter((e) => !ids.includes(e.id)),
    })),

  updateNode: (id, data) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      ),
    })),

  pushUndo: () =>
    set((state) => ({
      undoStack: [
        ...state.undoStack.slice(-49),
        { nodes: state.nodes, edges: state.edges },
      ],
      redoStack: [],
    })),

  undo: () => {
    const { undoStack, redoStack, nodes, edges } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, { nodes, edges }],
    });
  },

  redo: () => {
    const { redoStack, undoStack, nodes, edges } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      nodes: next.nodes,
      edges: next.edges,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, { nodes, edges }],
    });
  },
}));
