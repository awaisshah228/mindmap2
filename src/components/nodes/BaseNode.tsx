"use client";

import { type ReactNode, useCallback } from "react";
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
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const onMouseEnter = useCallback(() => setHoveredNodeId(nodeId), [nodeId, setHoveredNodeId]);
  const onMouseLeave = useCallback(() => setHoveredNodeId(null), [setHoveredNodeId]);

  const resolvedStyle: React.CSSProperties = {
    ...style,
    ...(node?.width != null && { width: node.width }),
    ...(node?.height != null && { height: node.height }),
  };

  return (
    <>
      <NodeInlineToolbar nodeId={nodeId} selected={selected} />
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
      <div
        className={cn(
          "transition-shadow",
          selected && "ring-2 ring-violet-400 ring-offset-1 shadow-md",
          className
        )}
        style={resolvedStyle}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
    </>
  );
}
