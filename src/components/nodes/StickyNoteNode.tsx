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
      <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />
      <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
      <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />
      <EditableNodeContent
        nodeId={id}
        value={label}
        placeholder="Sticky note"
        className="text-sm font-medium text-gray-800 break-words whitespace-pre-wrap"
        editOnlyViaToolbar
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
