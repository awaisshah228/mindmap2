"use client";

import { memo } from "react";
import {
  Handle,
  type NodeProps,
  Position,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";

const COLORS = [
  "#fef3c7", // amber
  "#d1fae5", // emerald
  "#dbeafe", // blue
  "#fce7f3", // pink
  "#e9d5ff", // purple
];

function StickyNoteNode({ id, data, selected }: NodeProps) {
  const color = (data.color as string) ?? COLORS[0];
  const label = (data.label as string) || "Sticky note";

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className={cn("min-w-[140px] min-h-[100px] rounded-lg shadow-md p-3")}
      style={{ backgroundColor: color }}
    >
      <Handle id="top" type="target" position={Position.Top} className={cn("!w-5 !h-5 !-top-2.5 !left-1/2 !-translate-x-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/80 opacity-80 hover:opacity-100" : "!opacity-0")} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={cn("!w-5 !h-5 !-bottom-2.5 !left-1/2 !-translate-x-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/80 opacity-80 hover:opacity-100" : "!opacity-0")} />
      <Handle id="left" type="target" position={Position.Left} className={cn("!w-5 !h-5 !-left-2.5 !top-1/2 !-translate-y-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/80 opacity-80 hover:opacity-100" : "!opacity-0")} />
      <Handle id="right" type="source" position={Position.Right} className={cn("!w-5 !h-5 !-right-2.5 !top-1/2 !-translate-y-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/80 opacity-80 hover:opacity-100" : "!opacity-0")} />
      <EditableNodeContent
        nodeId={id}
        value={label}
        placeholder="Sticky note"
        className="text-sm font-medium text-gray-800 break-words whitespace-pre-wrap"
        formatting={{
          fontWeight: (data.fontWeight as "normal" | "bold") ?? "normal",
          fontStyle: (data.fontStyle as "normal" | "italic") ?? "normal",
          textDecoration: (data.textDecoration as "none" | "line-through") ?? "none",
          fontSize: (data.fontSize as "xs" | "sm" | "base" | "lg" | "xl") ?? "sm",
        }}
      />
    </BaseNode>
  );
}

export default memo(StickyNoteNode);
