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
      <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
      <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />
      <EditableNodeContent
        nodeId={id}
        value={label}
        placeholder="Text"
        className="text-sm text-gray-800"
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
    </BaseNode>
  );
}

export default memo(TextNode);
