"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, useStore, useStoreApi } from "@xyflow/react";
import { Settings2, ArrowRight, ArrowDown, ArrowLeft, ArrowUp, Layout, X, PanelRight } from "lucide-react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  ALGORITHM_FAMILIES,
  ALGORITHM_SUB_OPTIONS,
  getAlgorithmFamily,
  getDefaultAlgorithmForFamily,
  normalizeMindMapEdgeHandles,
  type LayoutDirection,
} from "@/lib/layout-engine";
import { useApplyMindMapLayout } from "@/hooks/useApplyMindMapLayout";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type { Node, Edge } from "@xyflow/react";

const DIRECTIONS: { value: LayoutDirection; label: string; icon: React.ReactNode }[] = [
  { value: "LR", label: "Right", icon: <ArrowRight className="w-4 h-4" /> },
  { value: "TB", label: "Down", icon: <ArrowDown className="w-4 h-4" /> },
  { value: "RL", label: "Left", icon: <ArrowLeft className="w-4 h-4" /> },
  { value: "BT", label: "Up", icon: <ArrowUp className="w-4 h-4" /> },
];

interface MindMapLayoutPanelProps {
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  fitView?: () => void;
}

export function MindMapLayoutPanel({
  setNodes,
  setEdges,
  fitView: fitViewProp,
}: MindMapLayoutPanelProps) {
  const { applyLayout, nodes, edges } = useApplyMindMapLayout({
    setNodes,
    setEdges,
    fitView: fitViewProp,
  });
  const mindMapLayout = useCanvasStore((s) => s.mindMapLayout);
  const setMindMapLayout = useCanvasStore((s) => s.setMindMapLayout);
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [panelVisible, setPanelVisible] = useState(true);

  useEffect(() => {
    if (isMobile) setPanelVisible(false);
  }, [isMobile]);

  const hasMindMapNodes = useMemo(() => {
    return nodes.some(
      (n) => n.type === "mindMap" && !edges.some((e) => e.target === n.id)
    );
  }, [nodes, edges]);

  // Normalize mind map edge handles when direction changes (top/bottom vs left/right).
  // Only run on direction change - not on nodes change - to avoid update loops when adding nodes.
  const storeApi = useStoreApi();
  useEffect(() => {
    const { nodes } = storeApi.getState();
    const mindMapIds = new Set(nodes.filter((n) => n.type === "mindMap").map((n) => n.id));
    if (mindMapIds.size === 0) return;
    setEdges((prev) => normalizeMindMapEdgeHandles(nodes, prev, mindMapLayout.direction));
  }, [mindMapLayout.direction, setEdges, storeApi]);

  const handleAddRoot = useCallback(() => {
    pushUndo();
    const id = `node-${Date.now()}`;
    const newNode = {
      id,
      type: "mindMap" as const,
      position: { x: 100, y: 100 },
      data: { label: "Mind map" },
    };
    setNodes((nds: Node[]) => [...nds, { ...newNode, selected: true }]);
    setActiveTool("select");
  }, [setNodes, setActiveTool, pushUndo]);

  // Run layout on initial load when default template is shown (same as clicking "Layout whole tree")
  const hasRunInitialLayout = useRef(false);
  useEffect(() => {
    const isDefaultTemplate = nodes.some((n) => n.id === "mind-root") && edges.length > 0;
    if (!isDefaultTemplate || hasRunInitialLayout.current) return;
    const t = setTimeout(() => {
      hasRunInitialLayout.current = true;
      applyLayout();
    }, 100);
    return () => clearTimeout(t);
  }, [nodes, edges, applyLayout]);

  if (!panelVisible) {
    return (
      <Panel position="top-right" className="m-2">
        <button
          type="button"
          onClick={() => setPanelVisible(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/95 hover:bg-gray-700/95 text-gray-200 shadow-lg border border-gray-700 transition-colors"
          title="Show Mind Map Layout"
        >
          <PanelRight className="w-4 h-4" />
          <span className="text-sm font-medium">Layout</span>
        </button>
      </Panel>
    );
  }

  return (
    <Panel position="top-right" className="m-2">
      <div className="bg-gray-800/95 text-gray-200 rounded-lg shadow-lg border border-gray-700 p-3 min-w-[200px]">
        <div className="flex items-center justify-between gap-2 mb-3 text-sm font-medium">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Mind Map Layout
          </div>
          <button
            type="button"
            onClick={() => setPanelVisible(false)}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200 transition-colors"
            title="Hide panel"
            aria-label="Hide panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">algorithm</label>
            <select
              value={getAlgorithmFamily(mindMapLayout.algorithm)}
              onChange={(e) => {
                const family = e.target.value as "elk" | "dagre" | "d3";
                setMindMapLayout({
                  algorithm: getDefaultAlgorithmForFamily(family),
                });
              }}
              className="w-full px-2 py-1.5 text-sm rounded bg-gray-700 border border-gray-600 text-gray-200"
            >
              {ALGORITHM_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          {ALGORITHM_SUB_OPTIONS[getAlgorithmFamily(mindMapLayout.algorithm)].length > 1 && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">variant</label>
              <select
                value={mindMapLayout.algorithm}
                onChange={(e) =>
                  setMindMapLayout({
                    algorithm: e.target.value as typeof mindMapLayout.algorithm,
                  })
                }
                className="w-full px-2 py-1.5 text-sm rounded bg-gray-700 border border-gray-600 text-gray-200"
              >
                {ALGORITHM_SUB_OPTIONS[getAlgorithmFamily(mindMapLayout.algorithm)].map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-400 mb-1">direction</label>
            <div className="flex flex-wrap gap-1">
              {DIRECTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => {
                    if (hasMindMapNodes) {
                      applyLayout(d.value);
                    } else {
                      setMindMapLayout({ direction: d.value });
                    }
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                    mindMapLayout.direction === d.value
                      ? "bg-violet-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                  )}
                  title={d.label}
                >
                  {d.icon}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500 mt-0.5 block">
              {DIRECTIONS.find((d) => d.value === mindMapLayout.direction)?.label}
            </span>
          </div>
          <div className="flex gap-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">spacing X</label>
              <input
                type="number"
                min={10}
                max={200}
                value={mindMapLayout.spacingX}
                onChange={(e) =>
                  setMindMapLayout({ spacingX: Math.max(10, parseInt(e.target.value, 10) || 50) })
                }
                className="w-16 px-2 py-1.5 text-sm rounded bg-gray-700 border border-gray-600 text-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">spacing Y</label>
              <input
                type="number"
                min={10}
                max={200}
                value={mindMapLayout.spacingY}
                onChange={(e) =>
                  setMindMapLayout({ spacingY: Math.max(10, parseInt(e.target.value, 10) || 50) })
                }
                className="w-16 px-2 py-1.5 text-sm rounded bg-gray-700 border border-gray-600 text-gray-200"
              />
            </div>
          </div>
          {hasMindMapNodes ? (
            <button
              type="button"
              onClick={() => applyLayout()}
              className="w-full py-2 px-3 text-sm font-medium rounded bg-violet-600 hover:bg-violet-500 text-white transition-colors flex items-center justify-center gap-2"
            >
              <Layout className="w-4 h-4" />
              Layout whole tree
            </button>
          ) : (
            <button
              type="button"
              onClick={handleAddRoot}
              className="w-full py-2 px-3 text-sm font-medium rounded bg-gray-600 hover:bg-gray-500 text-gray-200 transition-colors"
            >
              add root node
            </button>
          )}
        </div>
      </div>
    </Panel>
  );
}
