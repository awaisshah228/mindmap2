"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { EditableNodeContent } from "./EditableNodeContent";
import { NodeInlineToolbar } from "@/components/toolbar/NodeInlineToolbar";

function TextNode({ id, data, selected }: NodeProps) {
  const label = (data.label as string) || "Text";
  const bgColor = data.color as string | undefined;

  return (
    <>
      <NodeInlineToolbar nodeId={id} />
      <div
        className={cn(
          "min-w-[80px] min-h-[32px] px-3 py-1.5 rounded",
          !bgColor && "bg-transparent",
          selected && "ring-2 ring-violet-500 ring-offset-1"
        )}
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      >
        <Handle id="left" type="target" position={Position.Left} className="opacity-0" />
        <Handle id="right" type="source" position={Position.Right} className="opacity-0" />
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
      </div>
    </>
  );
}

export default memo(TextNode);
