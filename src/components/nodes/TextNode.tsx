"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";

function TextNode({ id, data, selected }: NodeProps) {
  const label = (data.label as string) || "Text";
  const bgColor = data.color as string | undefined;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className={cn("min-w-[80px] min-h-[32px] px-3 py-1.5 rounded", !bgColor && "bg-transparent")}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <Handle id="left" type="target" position={Position.Left} className={cn("!w-5 !h-5 !-left-2.5 !top-1/2 !-translate-y-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/80 opacity-80 hover:opacity-100" : "!opacity-0")} />
      <Handle id="right" type="source" position={Position.Right} className={cn("!w-5 !h-5 !-right-2.5 !top-1/2 !-translate-y-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/80 opacity-80 hover:opacity-100" : "!opacity-0")} />
      <EditableNodeContent
        nodeId={id}
        value={label}
        placeholder="Text"
        className="text-sm text-gray-800"
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

export default memo(TextNode);
