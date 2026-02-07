"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Handle,
  type NodeProps,
  Position,
  useReactFlow,
  useUpdateNodeInternals,
  NodeResizer,
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
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { getHandlePositions, getHandleIds } from "@/lib/layout-engine";
import { getNodeBranchStyle } from "@/lib/branch-colors";
import { EditableNodeContent } from "./EditableNodeContent";
import { NodeInlineToolbar } from "@/components/toolbar/NodeInlineToolbar";
import { useMindMapLayout, useMindMapUpdateNodeData } from "@/contexts/MindMapLayoutContext";
import { getChildCount } from "@/lib/mindmap-utils";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { getIconById } from "@/lib/icon-registry";
import type { ExtraHandle } from "./BaseNode";

function MindMapNode({ id, data, selected }: NodeProps) {
  const mindMapLayout = useCanvasStore((s) => s.mindMapLayout);
  const { target: targetPos, source: sourcePos } = getHandlePositions(mindMapLayout.direction);
  const { target: targetHandleId, source: sourceHandleId } = getHandleIds(mindMapLayout.direction);
  const label = (data.label as string) || "Mind map";
  const collapsed = (data.collapsed as boolean) ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const { getNodes, getEdges, getNode } = useReactFlow();
  const node = getNode(id);
  const addAndLayout = useMindMapLayout();
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const router = useRouter();
  const updateNodeData = useMindMapUpdateNodeData();
  // Avoid calling getEdges() on every render — memoize derived values
  const { childCount, hasChildren, branchStyle } = useMemo(() => {
    const edges = getEdges();
    const cc = getChildCount(id, edges);
    return {
      childCount: cc,
      hasChildren: cc > 0,
      branchStyle: getNodeBranchStyle(id, edges, data.color as string | undefined),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data.color]);
  const customIcon = data.customIcon as string | undefined;
  const iconDef = getIconById(data.icon as string);
  const IconComponent = iconDef?.Icon;
  const presentationMode = useCanvasStore((s) => s.presentationMode);
  const activeTool = useCanvasStore((s) => s.activeTool);

  // Extra handles from node data
  const extraHandles: ExtraHandle[] = useMemo(
    () => (data?.extraHandles as ExtraHandle[] | undefined) ?? [],
    [data?.extraHandles]
  );

  // When extra handles change, tell React Flow to re-register the handles
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, extraHandles, updateNodeInternals]);

  const handleToggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hasChildren) return;
      pushUndo();
      updateNodeData?.(id, { collapsed: !collapsed });
    },
    [id, hasChildren, collapsed, updateNodeData, pushUndo]
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

  const isRoot = useMemo(() => !getEdges().some((e: { target: string }) => e.target === id), [id, getEdges]);
  const editRef = useRef<HTMLDivElement>(null);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    editRef.current?.focus();
  }, []);

  const setHoveredNodeId = useCanvasStore((s) => s.setHoveredNodeId);
  const onMouseEnter = useCallback(() => setHoveredNodeId(id), [id, setHoveredNodeId]);
  const onMouseLeave = useCallback(() => setHoveredNodeId(null), [setHoveredNodeId]);

  return (
    <>
      {!presentationMode && <NodeInlineToolbar nodeId={id} selected={selected} />}
      {!presentationMode && (
        <NodeResizer
          nodeId={id}
          isVisible={selected}
          minWidth={100}
          minHeight={36}
          color="rgb(139 92 246)"
          lineClassName="!border-violet-400"
          handleClassName="!bg-violet-400 !border-violet-500 !w-2 !h-2"
          onResizeStart={() => pushUndo()}
        />
      )}
      {/* Easy-connect overlay for connector tool — at top level for React Flow */}
      {activeTool === "connector" && (
        <Handle
          type="source"
          position={Position.Right}
          id="__easy-connect__"
          className="!absolute !inset-0 !w-full !h-full !rounded-none !bg-transparent !border-none !transform-none !left-0 !top-0 !translate-x-0 !translate-y-0 !opacity-0 hover:!opacity-100 hover:!bg-violet-400/10 !cursor-crosshair !transition-colors"
        />
      )}
      {/* Extra handles added by user — at top level for React Flow positioning */}
      {extraHandles.map((h) => {
        const posMap: Record<string, Position> = { top: Position.Top, bottom: Position.Bottom, left: Position.Left, right: Position.Right };
        const sty: React.CSSProperties =
          h.position === "top" || h.position === "bottom"
            ? { left: `${h.offset}%` }
            : { top: `${h.offset}%` };
        return (
          <Handle
            key={h.id}
            id={h.id}
            type="source"
            isConnectable
            position={posMap[h.position] ?? Position.Right}
            style={sty}
            className="extra-user-handle"
          />
        );
      })}
      <div
        className={cn(
          "group flex items-center transition-all",
          "min-w-[140px] min-h-[36px]"
        )}
        style={{
          ...(node?.width != null && { width: node.width }),
          ...(node?.height != null && { height: node.height }),
        }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* All 4 handles so edges always find their connection point (avoids disappearing when direction/layout mismatch) */}
        {/* Drag handle: large tap target for dragging on mobile — hidden in presentation & connector mode */}
        {!presentationMode && activeTool !== "connector" && (
          <div
            className="shrink-0 flex items-center justify-center w-9 min-w-[36px] h-9 min-h-[36px] rounded-l-2xl cursor-grab active:cursor-grabbing touch-manipulation opacity-70 hover:opacity-100 transition-opacity border border-transparent border-r-0"
            style={{
              backgroundColor: branchStyle.bg,
              borderColor: `${branchStyle.stroke}40`,
            }}
            title="Drag to move node"
            aria-label="Drag to move node"
          >
            <GripVertical className="w-5 h-5" style={{ color: branchStyle.stroke }} />
          </div>
        )}
        {/* Handles: always rendered (edges need them), but invisible in presentation mode.
            All handles are type="source" — with ConnectionMode.Loose this allows
            connecting from/to any handle without direction issues. */}
        <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
        <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />
        <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />
        <div
          className={cn(
            "flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 transition-all shadow-sm",
            (activeTool === "connector" || activeTool === "freeDraw" || activeTool === "eraser") && "nodrag",
            presentationMode ? "rounded-2xl" : activeTool === "connector" ? "rounded-2xl" : "rounded-r-2xl rounded-l-none",
            "border border-transparent",
            selected && !presentationMode && "ring-2 ring-violet-400 ring-offset-2 shadow-md"
          )}
          style={{
            backgroundColor: branchStyle.bg,
            borderColor: selected ? undefined : `${branchStyle.stroke}40`,
            color: branchStyle.text,
          }}
        >
          {!presentationMode && (hasChildren ? (
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
          ))}
          {(customIcon || IconComponent) && (
            <span className="shrink-0 opacity-90" style={IconComponent ? { color: branchStyle.stroke } : undefined}>
              {customIcon ? (
                <img src={customIcon} alt="" className="w-4 h-4 object-contain" />
              ) : IconComponent ? (
                <IconComponent className="w-4 h-4" />
              ) : null}
            </span>
          )}
          <EditableNodeContent
            nodeId={id}
            value={label}
            placeholder="Mind map"
            className="text-sm font-semibold flex-1 truncate min-w-0 outline-none [color:inherit]"
            editRef={editRef}
            editOnlyViaToolbar
            formatting={{
              fontWeight: (data.fontWeight as "normal" | "bold") ?? "normal",
              fontStyle: (data.fontStyle as "normal" | "italic") ?? "normal",
              textDecoration: (data.textDecoration as "none" | "line-through") ?? "none",
              fontSize: (data.fontSize as "xs" | "sm" | "base" | "lg" | "xl") ?? "sm",
              textAlign: (data.textAlign as "left" | "center" | "right") ?? "left",
              textVerticalAlign: (data.textVerticalAlign as "top" | "center" | "bottom") ?? "center",
            }}
          />
          {!presentationMode && (
            <button
              type="button"
              onClick={handleEdit}
              className="nodrag nokey shrink-0 flex items-center justify-center w-6 h-6 rounded hover:bg-black/5 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Edit"
              title="Edit text"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {!presentationMode && <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
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
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/ai-diagram?mode=mindmap-refine&nodeId=${encodeURIComponent(id)}&label=${encodeURIComponent(label)}`
                      )
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 rounded-md text-left"
                  >
                    <Wand2 className="w-4 h-4 shrink-0" />
                    AI refine this topic
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
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/ai-diagram?mode=mindmap-refine&nodeId=${encodeURIComponent(id)}&label=${encodeURIComponent(label)}`
                      )
                    }
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-violet-700 hover:bg-violet-50 rounded-md text-left"
                  >
                    <Wand2 className="w-4 h-4 shrink-0" />
                    AI refine this topic
                  </button>
                </>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>}
      </div>
    </>
  );
}

export default memo(MindMapNode);
