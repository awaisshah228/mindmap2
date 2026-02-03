import { type Node, type Edge } from "@xyflow/react";
import { create } from "zustand";
import type { LayoutDirection, LayoutAlgorithm } from "@/lib/layout-engine";

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
  | "freeDraw";

export type Tool = NodeType | "connector" | "pan" | "select" | "ai";

interface CanvasState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  activeTool: Tool;
  mindMapLayout: MindMapLayoutOptions;
  undoStack: { nodes: Node[]; edges: Edge[] }[];
  redoStack: { nodes: Node[]; edges: Edge[] }[];

  setMindMapLayout: (options: Partial<MindMapLayoutOptions>) => void;
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedEdgeIds: (ids: string[]) => void;
  setActiveTool: (tool: Tool) => void;
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
  activeTool: "select",
  mindMapLayout: DEFAULT_MIND_MAP_LAYOUT,
  undoStack: [],
  redoStack: [],

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

  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
    })),

  addNodes: (nodes) =>
    set((state) => ({
      nodes: [...state.nodes, ...nodes],
    })),

  addEdge: (edge) =>
    set((state) => ({
      edges: [...state.edges, edge],
    })),

  addEdges: (edges) =>
    set((state) => ({
      edges: [...state.edges, ...edges],
    })),

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
