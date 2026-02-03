"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { EditableNodeContent } from "./EditableNodeContent";
import { NodeInlineToolbar } from "@/components/toolbar/NodeInlineToolbar";

type ShapeType = "rectangle" | "diamond" | "circle" | "document";

function ShapeNode({ id, data, selected }: NodeProps) {
  const shape = (data.shape as ShapeType) ?? "rectangle";
  const label = (data.label as string) || "Node";
  const bgColor = data.color as string | undefined;

  const baseClasses =
    "min-w-[100px] min-h-[50px] flex items-center justify-center p-3 transition-shadow bg-white border-2 " +
    (selected ? "border-violet-500 shadow-md" : "border-gray-300");

  const formatProps = {
    formatting: {
      fontWeight: (data.fontWeight as "normal" | "bold") ?? "normal",
      fontStyle: (data.fontStyle as "normal" | "italic") ?? "normal",
      textDecoration: (data.textDecoration as "none" | "line-through") ?? "none",
      fontSize: (data.fontSize as "xs" | "sm" | "base" | "lg" | "xl") ?? "sm",
    },
  };

  if (shape === "diamond") {
    return (
      <>
        <NodeInlineToolbar nodeId={id} />
        <div className={cn(baseClasses, "!min-w-[90px] !min-h-[90px]")} style={bgColor ? { backgroundColor: bgColor } : undefined}>
          <div
            className="w-16 h-16 rotate-45 flex items-center justify-center bg-white border-2 border-gray-200"
            style={{ borderColor: selected ? "rgb(139 92 246)" : undefined }}
          >
            <EditableNodeContent
              nodeId={id}
              value={label}
              placeholder="Decision"
              className="text-xs text-gray-700 -rotate-45 truncate max-w-[60px]"
              {...formatProps}
            />
          </div>
          <Handle id="top" type="target" position={Position.Top} className="!w-2 !h-2" />
          <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2 !h-2" />
          <Handle id="left" type="target" position={Position.Left} className="!w-2 !h-2" />
          <Handle id="right" type="source" position={Position.Right} className="!w-2 !h-2" />
        </div>
      </>
    );
  }

  return (
    <>
      <NodeInlineToolbar nodeId={id} />
      <div
        className={cn(
          baseClasses,
          shape === "circle" && "rounded-full !min-w-[70px] !min-h-[70px]",
          shape === "rectangle" && "rounded",
          shape === "document" && "rounded-tl rounded-tr rounded-br-lg rounded-bl-lg"
        )}
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      >
        <Handle id="top" type="target" position={Position.Top} className="!w-2 !h-2" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="!w-2 !h-2" />
        <Handle id="left" type="target" position={Position.Left} className="!w-2 !h-2" />
        <Handle id="right" type="source" position={Position.Right} className="!w-2 !h-2" />
        <EditableNodeContent
          nodeId={id}
          value={label}
          placeholder="Node"
          className="text-sm text-gray-700 truncate px-1"
          {...formatProps}
        />
      </div>
    </>
  );
}

export default memo(ShapeNode);
