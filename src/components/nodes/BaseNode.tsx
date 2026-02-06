"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Handle, NodeResizer, Position, useReactFlow, useUpdateNodeInternals } from "@xyflow/react";
import { NodeInlineToolbar } from "@/components/toolbar/NodeInlineToolbar";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { cn } from "@/lib/utils";

/* ──────────────── Extra Handles ──────────────── */

/** A single user-added handle stored in `node.data.extraHandles`. */
export interface ExtraHandle {
  /** Unique id, e.g. "extra-top-1" */
  id: string;
  /** Side of the node */
  position: "top" | "bottom" | "left" | "right";
  /** Offset % along that side (0–100). 50 = center. */
  offset: number;
}

const POSITION_MAP: Record<string, Position> = {
  top: Position.Top,
  bottom: Position.Bottom,
  left: Position.Left,
  right: Position.Right,
};

/**
 * Returns inline style to position an extra handle at `offset%` along its side.
 * React Flow's default Handle puts the handle at 50% along the side with
 * `transform: translate(-50%, -50%)`. We override `left` or `top` to move it
 * to the desired offset, keeping the centering transform intact.
 */
function extraHandleStyle(pos: string, offset: number): React.CSSProperties {
  if (pos === "top" || pos === "bottom") {
    return { left: `${offset}%` };
  }
  // left / right
  return { top: `${offset}%` };
}

/* ──────────────── BaseNode ──────────────── */

export interface BaseNodeProps {
  nodeId: string;
  selected?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Min width when resizing (default 50). */
  minWidth?: number;
  /** Min height when resizing (default 30). */
  minHeight?: number;
  children: ReactNode;
}

/**
 * Reusable wrapper for custom nodes: toolbar + selection ring + NodeResizer + content.
 * Use for shape, sticky note, text, and other node types that share this layout.
 */
export function BaseNode({
  nodeId,
  selected,
  className,
  style,
  minWidth = 50,
  minHeight = 30,
  children,
}: BaseNodeProps) {
  const { getNode } = useReactFlow();
  const node = getNode(nodeId);
  const setHoveredNodeId = useCanvasStore((s) => s.setHoveredNodeId);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const onMouseEnter = useCallback(() => setHoveredNodeId(nodeId), [nodeId, setHoveredNodeId]);
  const onMouseLeave = useCallback(() => setHoveredNodeId(null), [setHoveredNodeId]);

  // Task progress
  const tasks = useCanvasStore((s) => s.nodeTasks[nodeId]);
  const taskProgress = useMemo(() => {
    if (!tasks || tasks.length === 0) return null;
    const done = tasks.filter((t) => t.done).length;
    return { done, total: tasks.length, percent: (done / tasks.length) * 100 };
  }, [tasks]);

  // Extra handles from node data
  const extraHandles = useMemo(
    () => (node?.data?.extraHandles as ExtraHandle[] | undefined) ?? [],
    [node?.data?.extraHandles]
  );

  // When extra handles change, tell React Flow to re-register the handles
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(nodeId);
  }, [nodeId, extraHandles, updateNodeInternals]);

  const resolvedStyle: React.CSSProperties = {
    ...style,
    ...(node?.width != null && { width: node.width }),
    ...(node?.height != null && { height: node.height }),
  };

  const presentationMode = useCanvasStore((s) => s.presentationMode);
  const { updateNodeData } = useReactFlow();

  // ── Floating annotation label (stored in node.data.annotation) ──
  const annotation = (node?.data?.annotation as string | undefined) ?? "";
  const [isEditingAnnotation, setIsEditingAnnotation] = useState(false);
  const [annotationValue, setAnnotationValue] = useState(annotation);
  const annotationInputRef = useRef<HTMLInputElement>(null);
  const prevAnnotationRef = useRef(annotation);

  // Sync external annotation changes without calling setState in an effect
  if (prevAnnotationRef.current !== annotation && !isEditingAnnotation) {
    prevAnnotationRef.current = annotation;
    setAnnotationValue(annotation);
  }

  const handleAnnotationSave = useCallback(() => {
    setIsEditingAnnotation(false);
    const trimmed = annotationValue.trim();
    if (trimmed !== annotation) {
      updateNodeData(nodeId, { annotation: trimmed || undefined });
    }
  }, [nodeId, annotationValue, annotation, updateNodeData]);

  const handleAnnotationKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { handleAnnotationSave(); }
    if (e.key === "Escape") { setIsEditingAnnotation(false); setAnnotationValue(annotation); }
  }, [handleAnnotationSave, annotation]);

  return (
    <>
      {!presentationMode && <NodeInlineToolbar nodeId={nodeId} selected={selected} />}
      {!presentationMode && (
        <NodeResizer
          nodeId={nodeId}
          isVisible={selected}
          minWidth={minWidth}
          minHeight={minHeight}
          color="rgb(139 92 246)"
          lineClassName="!border-2 !border-violet-400 !bg-transparent"
          handleClassName="!w-3 !h-3 !min-w-3 !min-h-3 !rounded-none !bg-white !border-2 !border-violet-400 !shadow-sm hover:!bg-gray-50"
          onResizeStart={() => pushUndo()}
        />
      )}
      {/* Easy-connect overlay: when connector tool is active, the entire node surface
          acts as a source handle so dragging anywhere starts a connection. */}
      {activeTool === "connector" && (
        <Handle
          type="source"
          position={Position.Right}
          id="__easy-connect__"
          className="!absolute !inset-0 !w-full !h-full !rounded-none !bg-transparent !border-none !transform-none !left-0 !top-0 !translate-x-0 !translate-y-0 !opacity-0 hover:!opacity-100 hover:!bg-violet-400/10 !cursor-crosshair !transition-colors"
        />
      )}
      {/* Extra handles added by user through the toolbar — rendered at top level
          so React Flow positions them relative to the node wrapper (.react-flow__node) */}
      {extraHandles.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          isConnectable
          position={POSITION_MAP[h.position] ?? Position.Right}
          style={extraHandleStyle(h.position, h.offset)}
          className="extra-user-handle"
        />
      ))}
      <div
        className={cn(
          "relative transition-shadow",
          selected && !presentationMode && "ring-2 ring-violet-400 ring-offset-1 shadow-md",
          className
        )}
        style={resolvedStyle}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div
          className={cn(
            "h-full w-full",
            // Prevent drag only when drawing/connecting: freeDraw, connector, eraser.
            // Select / move / pan: user can always drag node to move it (React Flow–style).
            (activeTool === "freeDraw" || activeTool === "connector" || activeTool === "eraser") && "nodrag"
          )}
        >
          {children}
        </div>
        {/* Task progress bar */}
        {taskProgress && (
          <div className="absolute -bottom-1.5 left-1 right-1 h-1.5 bg-gray-200 rounded-full overflow-hidden" title={`Tasks: ${taskProgress.done}/${taskProgress.total}`}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${taskProgress.percent}%`,
                backgroundColor: taskProgress.percent === 100 ? "#22c55e" : "#8b5cf6",
              }}
            />
          </div>
        )}
      </div>
      {/* ── Floating annotation label below node ── */}
      {(annotation || isEditingAnnotation) && (
        <div
          className="absolute left-1/2 -translate-x-1/2 mt-1 nodrag nopan"
          style={{ top: "100%" }}
        >
          {isEditingAnnotation ? (
            <input
              ref={annotationInputRef}
              autoFocus
              value={annotationValue}
              onChange={(e) => setAnnotationValue(e.target.value)}
              onBlur={handleAnnotationSave}
              onKeyDown={handleAnnotationKeyDown}
              className="px-2 py-0.5 text-[11px] text-center bg-white border border-violet-300 rounded shadow-sm outline-none ring-2 ring-violet-200 min-w-[60px] max-w-[200px]"
              placeholder="Label..."
            />
          ) : (
            <div
              className={cn(
                "px-2 py-0.5 text-[11px] text-center text-gray-600 bg-white/90 border border-gray-200 rounded shadow-sm whitespace-nowrap max-w-[200px] truncate",
                selected && "cursor-text hover:border-violet-300"
              )}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingAnnotation(true);
              }}
              title={annotation}
            >
              {annotation}
            </div>
          )}
        </div>
      )}
    </>
  );
}
