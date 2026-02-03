"use client";

import { memo } from "react";
import {
  Handle,
  type NodeProps,
  Position,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { EditableNodeContent } from "./EditableNodeContent";
import { NodeInlineToolbar } from "@/components/toolbar/NodeInlineToolbar";

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
    <>
      <NodeInlineToolbar nodeId={id} />
      <div
        className={cn(
          "min-w-[140px] min-h-[100px] rounded-lg shadow-md p-3 transition-shadow",
          selected && "ring-2 ring-violet-500 ring-offset-2"
        )}
        style={{
          backgroundColor: color,
        }}
      >
        <Handle id="top" type="target" position={Position.Top} className="opacity-0" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="opacity-0" />
        <Handle id="left" type="target" position={Position.Left} className="opacity-0" />
        <Handle id="right" type="source" position={Position.Right} className="opacity-0" />
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
      </div>
    </>
  );
}

export default memo(StickyNoteNode);
