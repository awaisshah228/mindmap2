"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";

const SIZE = 12;

/**
 * Minimal node used as an endpoint for standalone edges (drawn with the connector tool).
 * Draggable; edges connect to its handles. No toolbar or resizer.
 */
function EdgeAnchorNode({ id, selected }: NodeProps) {
  return (
    <div
      className={cn(
        "rounded-full border-2 transition-all cursor-grab active:cursor-grabbing",
        selected
          ? "bg-white border-violet-400 ring-2 ring-violet-400 ring-offset-1 shadow-md"
          : "bg-transparent border-transparent hover:bg-gray-300/40 hover:border-gray-400/60"
      )}
      style={{ width: SIZE, height: SIZE }}
      title="Standalone connector endpoint — drag to move, select to connect"
    >
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        className={cn(
          "!w-2 !h-2 !-left-1 !top-1/2 !-translate-y-1/2 !border-2 !border-violet-500 !bg-white !transition-opacity",
          selected ? "!opacity-100" : "!opacity-0"
        )}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className={cn(
          "!w-2 !h-2 !-right-1 !top-1/2 !-translate-y-1/2 !border-2 !border-violet-500 !bg-white !transition-opacity",
          selected ? "!opacity-100" : "!opacity-0"
        )}
      />
    </div>
  );
}

export default memo(EdgeAnchorNode);
