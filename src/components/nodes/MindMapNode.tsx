"use client";

import { memo, useCallback, useRef, useState } from "react";
import {
  Handle,
  type NodeProps,
  Position,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import * as Popover from "@radix-ui/react-popover";
import {
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getHandlePositions, getHandleIds } from "@/lib/layout-engine";
import { getNodeBranchStyle } from "@/lib/branch-colors";
import { EditableNodeContent } from "./EditableNodeContent";
import { NodeInlineToolbar } from "@/components/toolbar/NodeInlineToolbar";
import { useMindMapLayout, useMindMapUpdateNodeData } from "@/contexts/MindMapLayoutContext";
import { getChildCount } from "@/lib/mindmap-utils";
import { useCanvasStore } from "@/lib/store/canvas-store";

function MindMapNode({ id, data, selected }: NodeProps) {
  const mindMapLayout = useCanvasStore((s) => s.mindMapLayout);
  const { target: targetPos, source: sourcePos } = getHandlePositions(mindMapLayout.direction);
  const { target: targetHandleId, source: sourceHandleId } = getHandleIds(mindMapLayout.direction);
  const label = (data.label as string) || "Mind map";
  const collapsed = (data.collapsed as boolean) ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const { getNodes, getEdges } = useReactFlow();
  const addAndLayout = useMindMapLayout();
  const updateNodeData = useMindMapUpdateNodeData();
  const edges = getEdges();
  const childCount = getChildCount(id, edges);
  const hasChildren = childCount > 0;
  const branchStyle = getNodeBranchStyle(
    id,
    edges,
    data.color as string | undefined
  );

  const handleToggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hasChildren) return;
      updateNodeData?.(id, { collapsed: !collapsed });
    },
    [id, hasChildren, collapsed, updateNodeData]
  );

  const handleAddBelow = useCallback(() => {
    setMenuOpen(false);
    const nodes = getNodes();
    const thisNode = nodes.find((n) => n.id === id);
    if (!thisNode) return;
    const newNodeId = `node-${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: "mindMap",
      position: { x: thisNode.position.x + 200, y: thisNode.position.y },
      data: { label: "" },
    };
    const newEdge: Edge = {
      id: `e${id}-source-${newNodeId}-target-${Date.now()}`,
      source: id,
      target: newNodeId,
      sourceHandle: sourceHandleId,
      targetHandle: targetHandleId,
      type: "labeledConnector",
      data: { connectorType: "default" },
    };
    addAndLayout?.(newNode, newEdge);
  }, [id, getNodes, addAndLayout, sourceHandleId, targetHandleId]);

  const handleAddParallel = useCallback(() => {
    setMenuOpen(false);
    const nodes = getNodes();
    const edges = getEdges();
    const thisNode = nodes.find((n) => n.id === id);
    if (!thisNode) return;
    const parentEdge = edges.find((e) => e.target === id);
    const parentId = parentEdge?.source;
    if (!parentId) return; // should not happen for non-root
    const newNodeId = `node-${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: "mindMap",
      position: { x: thisNode.position.x, y: thisNode.position.y + 80 },
      data: { label: "" },
    };
    const newEdge: Edge = {
      id: `e${parentId}-source-${newNodeId}-target-${Date.now()}`,
      source: parentId,
      target: newNodeId,
      sourceHandle: sourceHandleId,
      targetHandle: targetHandleId,
      type: "labeledConnector",
      data: { connectorType: "default" },
    };
    addAndLayout?.(newNode, newEdge);
  }, [id, getNodes, getEdges, addAndLayout, sourceHandleId, targetHandleId]);

  const handleAddBackward = useCallback(() => {
    setMenuOpen(false);
    const nodes = getNodes();
    const thisNode = nodes.find((n) => n.id === id);
    if (!thisNode) return;
    const newNodeId = `node-${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: "mindMap",
      position: { x: thisNode.position.x - 200, y: thisNode.position.y },
      data: { label: "" },
    };
    const newEdge: Edge = {
      id: `e${newNodeId}-source-${id}-target-${Date.now()}`,
      source: newNodeId,
      target: id,
      sourceHandle: sourceHandleId,
      targetHandle: targetHandleId,
      type: "labeledConnector",
      data: { connectorType: "default" },
    };
    addAndLayout?.(newNode, newEdge);
  }, [id, getNodes, addAndLayout, sourceHandleId, targetHandleId]);

  const isRoot = !edges.some((e) => e.target === id);
  const editRef = useRef<HTMLDivElement>(null);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    editRef.current?.focus();
  }, []);

  return (
    <>
      <NodeInlineToolbar nodeId={id} />
      <div
        className={cn(
          "group flex items-center transition-all",
          "min-w-[140px] min-h-[36px]"
        )}
      >
        {/* All 4 handles so edges always find their connection point (avoids disappearing when direction/layout mismatch) */}
        {/* Drag handle: large tap target for dragging on mobile */}
        <div
          className="shrink-0 flex items-center justify-center w-9 min-w-[36px] h-9 min-h-[36px] rounded-l-2xl cursor-grab active:cursor-grabbing touch-manipulation opacity-70 hover:opacity-100 transition-opacity border border-transparent border-r-0"
          style={{
            backgroundColor: branchStyle.bg,
            borderColor: `${branchStyle.stroke}40`,
          }}
          title="Drag to move"
          aria-label="Drag handle"
        >
          <GripVertical className="w-5 h-5" style={{ color: branchStyle.stroke }} />
        </div>
        <Handle
          id="left"
          type={sourceHandleId === "left" ? "source" : "target"}
          position={Position.Left}
          className="!w-2 !h-2 !min-w-2 !min-h-2 !rounded-full !border !border-gray-300/60 !-left-1 opacity-50 hover:!opacity-100 !transition-all"
          style={{ backgroundColor: branchStyle.bg, borderColor: branchStyle.stroke }}
        />
        <Handle
          id="right"
          type={sourceHandleId === "right" ? "source" : "target"}
          position={Position.Right}
          className="!w-2 !h-2 !min-w-2 !min-h-2 !rounded-full !border !border-gray-300/60 !-right-1 opacity-50 hover:!opacity-100 !transition-all"
          style={{ backgroundColor: branchStyle.bg, borderColor: branchStyle.stroke }}
        />
        <Handle
          id="top"
          type={sourceHandleId === "top" ? "source" : "target"}
          position={Position.Top}
          className="!w-2 !h-2 !min-w-2 !min-h-2 !rounded-full !border !border-gray-300/60 !-top-1 opacity-50 hover:!opacity-100 !transition-all"
          style={{ backgroundColor: branchStyle.bg, borderColor: branchStyle.stroke }}
        />
        <Handle
          id="bottom"
          type={sourceHandleId === "bottom" ? "source" : "target"}
          position={Position.Bottom}
          className="!w-2 !h-2 !min-w-2 !min-h-2 !rounded-full !border !border-gray-300/60 !-bottom-1 opacity-50 hover:!opacity-100 !transition-all"
          style={{ backgroundColor: branchStyle.bg, borderColor: branchStyle.stroke }}
        />
        <div
          className={cn(
            "flex-1 min-w-0 flex items-center gap-2 rounded-r-2xl rounded-l-none px-3 py-2.5 transition-all shadow-sm",
            "border border-transparent",
            selected && "ring-2 ring-violet-400 ring-offset-2 shadow-md"
          )}
          style={{
            backgroundColor: branchStyle.bg,
            borderColor: selected ? undefined : `${branchStyle.stroke}40`,
            color: branchStyle.text,
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="nodrag nokey shrink-0 flex items-center justify-center w-7 h-7 rounded-full hover:opacity-90 transition-opacity"
              style={{ backgroundColor: branchStyle.stroke, color: "white" }}
              aria-label={collapsed ? "Expand" : "Collapse"}
              title={collapsed ? `Expand (${childCount} children)` : `Collapse (${childCount} children)`}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-7 shrink-0" aria-hidden />
          )}
          <EditableNodeContent
            nodeId={id}
            value={label}
            placeholder="Mind map"
            className="text-sm font-semibold flex-1 truncate min-w-0 outline-none [color:inherit]"
            editRef={editRef}
            formatting={{
              fontWeight: (data.fontWeight as "normal" | "bold") ?? "normal",
              fontStyle: (data.fontStyle as "normal" | "italic") ?? "normal",
              textDecoration: (data.textDecoration as "none" | "line-through") ?? "none",
              fontSize: (data.fontSize as "xs" | "sm" | "base" | "lg" | "xl") ?? "sm",
            }}
          />
          <button
            type="button"
            onClick={handleEdit}
            className="nodrag nokey shrink-0 flex items-center justify-center w-6 h-6 rounded hover:bg-black/5 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Edit"
            title="Edit text"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
        <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="nodrag nokey flex items-center justify-center shrink-0 w-7 h-7 rounded-full bg-white/80 hover:bg-white border border-gray-200/80 text-gray-600 hover:text-gray-900 shadow-sm transition-colors"
              aria-label="Add node"
              title="Add node"
            >
              +
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-50 w-48 rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
              sideOffset={4}
              align="end"
            >
              {isRoot ? (
                <>
                  <button
                    type="button"
                    onClick={handleAddBackward}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                  >
                    <ArrowLeft className="w-4 h-4 shrink-0" />
                    Add backward
                  </button>
                  <button
                    type="button"
                    onClick={handleAddBelow}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                  >
                    <ArrowRight className="w-4 h-4 shrink-0" />
                    Add child
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleAddBelow}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                  >
                    <AlignVerticalSpaceAround className="w-4 h-4 shrink-0" />
                    Add below
                  </button>
                  <button
                    type="button"
                    onClick={handleAddParallel}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md text-left"
                  >
                    <AlignHorizontalSpaceAround className="w-4 h-4 shrink-0" />
                    Add parallel
                  </button>
                </>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </>
  );
}

export default memo(MindMapNode);
