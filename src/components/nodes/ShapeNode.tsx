"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { SHAPE_PATHS, type ShapeType } from "@/lib/shape-types";
import { PALETTE_COLORS } from "@/lib/branch-colors";
import { getIconById } from "@/lib/icon-registry";

const DEFAULT_SHAPE: ShapeType = "rectangle";
const WIDTH = 140;
const HEIGHT = 72;

function ShapeNode({ id, data, selected }: NodeProps) {
  const shape = (data.shape as ShapeType) ?? DEFAULT_SHAPE;
  const label = (data.label as string) || "Node";
  const bgColor = (data.color as string) ?? PALETTE_COLORS[0];
  const pathD = (SHAPE_PATHS[shape as ShapeType] ?? SHAPE_PATHS.rectangle);
  const customIcon = data.customIcon as string | undefined;
  const iconDef = getIconById(data.icon as string);
  const IconComponent = iconDef?.Icon;

  const formatProps = {
    formatting: {
      fontWeight: (data.fontWeight as "normal" | "bold") ?? "normal",
      fontStyle: (data.fontStyle as "normal" | "italic") ?? "normal",
      textDecoration: (data.textDecoration as "none" | "line-through") ?? "none",
      fontSize: (data.fontSize as "xs" | "sm" | "base" | "lg" | "xl") ?? "sm",
    },
  };

  return (
    <BaseNode nodeId={id} selected={selected} className="relative" style={{ width: WIDTH, height: HEIGHT }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 pointer-events-none"
        >
          <path
            d={pathD}
            fill={bgColor}
            stroke={selected ? "rgb(139 92 246)" : "rgb(148 163 184)"}
            strokeWidth={selected ? 3 : 1.5}
            className="pointer-events-auto"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center p-2 pointer-events-none gap-0.5">
          {customIcon ? (
            <img src={customIcon} alt="" className="w-5 h-5 object-contain shrink-0 pointer-events-none" />
          ) : IconComponent ? (
            <span className="pointer-events-none shrink-0 text-gray-600">
              <IconComponent className="w-5 h-5" />
            </span>
          ) : null}
          <div className="pointer-events-auto nodrag nokey w-full min-w-0 text-center">
            <EditableNodeContent
              nodeId={id}
              value={label}
              placeholder="Node"
              className="text-sm text-gray-800 truncate max-w-full mx-auto"
              editOnlyViaToolbar
              {...formatProps}
            />
          </div>
        </div>
        {/* Connection handles — invisible unless selected (CSS driven) */}
        <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />
        <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
        <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />
    </BaseNode>
  );
}

export default memo(ShapeNode);
export type { ShapeType };
