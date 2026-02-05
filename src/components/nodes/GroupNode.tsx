"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import { cn } from "@/lib/utils";

const MIN_GROUP_WIDTH = 120;
const MIN_GROUP_HEIGHT = 80;

/**
 * Subflow / group container node. Resizable; child nodes use parentId pointing to this node's id.
 * Any node type (shape, image, icon, etc.) can be a child when dropped inside.
 */
function GroupNode({ id, data, selected }: NodeProps) {
  const label = (data.label as string) || "Group";
  const hoveredGroupId = (data.hoveredGroupId as string) ?? null;
  const isHovered = hoveredGroupId === id;

  return (
    <>
      <NodeResizer
        nodeId={id}
        isVisible={selected}
        minWidth={MIN_GROUP_WIDTH}
        minHeight={MIN_GROUP_HEIGHT}
        color="rgb(139 92 246)"
        lineClassName="!border-2 !border-violet-400 !bg-transparent"
        handleClassName="!w-3 !h-3 !min-w-3 !min-h-3 !rounded-none !bg-white !border-2 !border-violet-400 !shadow-sm hover:!bg-gray-50"
      />
      <div
        className={cn(
          "rounded-lg border-2 bg-slate-100/90 overflow-hidden w-full h-full transition-colors",
          selected ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-300",
          isHovered && !selected && "border-violet-300 bg-violet-50/80 ring-2 ring-violet-200/60"
        )}
        style={{ minWidth: MIN_GROUP_WIDTH, minHeight: MIN_GROUP_HEIGHT }}
      >
        <div className="px-3 py-2 border-b border-slate-300/80 bg-slate-200/80 text-xs font-semibold text-slate-700 truncate">
          {label}
        </div>
        <div className="w-full h-[calc(100%-28px)]" />
      </div>
    </>
  );
}

export default memo(GroupNode);
