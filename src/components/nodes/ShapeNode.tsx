"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { LayoutHandles } from "./LayoutHandles";
import { SHAPE_PATHS, type ShapeType } from "@/lib/shape-types";
import { PALETTE_COLORS } from "@/lib/branch-colors";
import { getIconById } from "@/lib/icon-registry";
import { cn } from "@/lib/utils";
import type { LayoutDirection } from "@/lib/layout-engine";

const DEFAULT_SHAPE: ShapeType = "rectangle";
const MIN_WIDTH = 100;
const MIN_HEIGHT = 48;
const MAX_WIDTH = 280;
const MAX_HEIGHT = 200;
/** Labels longer than this: render text-only (no shape) so text fits. */
const LONG_TEXT_THRESHOLD = 50;

function ShapeNode({ id, data, selected }: NodeProps) {
  const shape = (data.shape as ShapeType) ?? DEFAULT_SHAPE;
  const label = (data.label as string) || "Node";
  const bgColor = (data.color as string) ?? PALETTE_COLORS[0];
  const pathD = (SHAPE_PATHS[shape as ShapeType] ?? SHAPE_PATHS.rectangle);
  const customIcon = data.customIcon as string | undefined;
  const iconUrl = data.iconUrl as string | undefined;
  const iconDef = getIconById(data.icon as string);
  const IconComponent = iconDef?.Icon;

  const textAlign = (data.textAlign as "left" | "center" | "right") ?? "center";
  const textVerticalAlign = (data.textVerticalAlign as "top" | "center" | "bottom") ?? "center";
  const formatProps = {
    formatting: {
      fontWeight: (data.fontWeight as "normal" | "bold") ?? "normal",
      fontStyle: (data.fontStyle as "normal" | "italic") ?? "normal",
      textDecoration: (data.textDecoration as "none" | "line-through") ?? "none",
      fontSize: (data.fontSize as "xs" | "sm" | "base" | "lg" | "xl") ?? "sm",
      textAlign,
      textVerticalAlign,
    },
  };
  const itemsClass = { left: "items-start", center: "items-center", right: "items-end" }[textAlign];
  const justifyClass = { top: "justify-start", center: "justify-center", bottom: "justify-end" }[textVerticalAlign];

  const isLongText = label.length > LONG_TEXT_THRESHOLD;
  const layoutHandles = data.layoutHandles as { source: number; target: number } | undefined;
  const layoutDir = (data.layoutDirection as LayoutDirection) ?? "LR";

  const renderHandles = () => {
    if (layoutHandles && layoutHandles.source >= 1 && layoutHandles.target >= 1) {
      return (
        <LayoutHandles
          nodeId={id}
          direction={layoutDir}
          sourceCount={layoutHandles.source}
          targetCount={layoutHandles.target}
        />
      );
    }
    return (
      <>
        <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />
        <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
        <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />
      </>
    );
  };

  if (isLongText) {
    return (
      <BaseNode
        nodeId={id}
        selected={selected}
        className="relative px-3 py-2 rounded min-w-[80px] bg-transparent"
        style={{ minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH, width: "fit-content" }}
      >
        <div className="pointer-events-auto nodrag nokey text-center break-words">
          <EditableNodeContent
            nodeId={id}
            value={label}
            placeholder="Node"
            className="text-sm text-gray-800"
            editOnlyViaToolbar
            {...formatProps}
          />
        </div>
        {renderHandles()}
      </BaseNode>
    );
  }

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className="relative"
      style={{
        minWidth: MIN_WIDTH,
        minHeight: MIN_HEIGHT,
        maxWidth: MAX_WIDTH,
        maxHeight: MAX_HEIGHT,
        width: "fit-content",
        height: "fit-content",
        padding: "8px 12px",
      }}
    >
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
      <div className={cn("relative flex flex-col pointer-events-none gap-0.5 min-h-full", itemsClass, justifyClass)}>
        {customIcon ? (
          <img src={customIcon} alt="" className="w-5 h-5 object-contain shrink-0 pointer-events-none" />
        ) : IconComponent ? (
          <span className="pointer-events-none shrink-0 text-gray-600">
            <IconComponent className="w-5 h-5" />
          </span>
        ) : iconUrl ? (
          <img src={iconUrl} alt="" className="w-5 h-5 object-contain shrink-0 pointer-events-none" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : null}
        <div className="pointer-events-auto nodrag nokey w-full min-w-0 break-words">
          <EditableNodeContent
            nodeId={id}
            value={label}
            placeholder="Node"
            className="text-sm text-gray-800 max-w-full mx-auto"
            editOnlyViaToolbar
            {...formatProps}
          />
        </div>
      </div>
      {renderHandles()}
    </BaseNode>
  );
}

export default memo(ShapeNode);
export type { ShapeType };
