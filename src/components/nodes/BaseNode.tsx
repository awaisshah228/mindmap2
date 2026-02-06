"use client";

import { type ReactNode, useCallback, useMemo } from "react";
import { NodeResizer, useReactFlow } from "@xyflow/react";
import { NodeInlineToolbar } from "@/components/toolbar/NodeInlineToolbar";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { cn } from "@/lib/utils";

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

  const resolvedStyle: React.CSSProperties = {
    ...style,
    ...(node?.width != null && { width: node.width }),
    ...(node?.height != null && { height: node.height }),
  };

  const presentationMode = useCanvasStore((s) => s.presentationMode);

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
    </>
  );
}
