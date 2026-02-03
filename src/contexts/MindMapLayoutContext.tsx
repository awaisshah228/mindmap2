"use client";

import { createContext, useContext } from "react";
import type { Node, Edge } from "@xyflow/react";

export type AddMindMapNodeHandler = (
  newNode: Node,
  newEdge: Edge
) => void | Promise<void>;

export type UpdateNodeDataHandler = (
  nodeId: string,
  data: Record<string, unknown>
) => void;

interface MindMapLayoutContextValue {
  addAndLayout: AddMindMapNodeHandler | null;
  updateNodeData: UpdateNodeDataHandler | null;
}

const MindMapLayoutContext = createContext<MindMapLayoutContextValue>({
  addAndLayout: null,
  updateNodeData: null,
});

export function MindMapLayoutProvider({
  children,
  onAddAndLayout,
  onUpdateNodeData,
}: {
  children: React.ReactNode;
  onAddAndLayout: AddMindMapNodeHandler;
  onUpdateNodeData: UpdateNodeDataHandler;
}) {
  return (
    <MindMapLayoutContext.Provider
      value={{ addAndLayout: onAddAndLayout, updateNodeData: onUpdateNodeData }}
    >
      {children}
    </MindMapLayoutContext.Provider>
  );
}

export function useMindMapLayout() {
  return useContext(MindMapLayoutContext).addAndLayout;
}

export function useMindMapUpdateNodeData() {
  return useContext(MindMapLayoutContext).updateNodeData;
}
