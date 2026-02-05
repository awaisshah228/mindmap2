import { type Node, type Edge } from "@xyflow/react";
import { create } from "zustand";
import type { LayoutDirection, LayoutAlgorithm } from "@/lib/layout-engine";
import type { ShapeType } from "@/lib/shape-types";

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

  /** Last AI prompt used to generate/update the diagram (for refinement). */
  lastAIPrompt: string | null;
  /** Last AI-generated diagram (nodes + edges) stored for refinement context. */
  lastAIDiagram: { nodes: Node[]; edges: Edge[] } | null;

  /** When set, the node with this id should focus its main label for editing (toolbar "Edit text" button). */
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;

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
  setPendingImage: (url: string | null, label?: string | null) => void;
  setPendingEdgeType: (type: PendingEdgeType) => void;
  setPendingFitView: (value: boolean) => void;
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
  pendingImageUrl: null,
  pendingImageLabel: null,
  pendingEdgeType: "default",
  mindMapLayout: DEFAULT_MIND_MAP_LAYOUT,
  undoStack: [],
  redoStack: [],
  pendingFitView: false,
  lastAIPrompt: null,
  lastAIDiagram: null,
  editingNodeId: null,

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
  setPendingImage: (url, label) =>
    set({ pendingImageUrl: url ?? null, pendingImageLabel: label ?? null }),
  setPendingEdgeType: (type) => set({ pendingEdgeType: type }),
  setPendingFitView: (value) => set({ pendingFitView: value }),
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
