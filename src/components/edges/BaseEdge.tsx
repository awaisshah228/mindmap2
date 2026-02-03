"use client";

import { memo } from "react";
import { BaseEdge as ReactFlowBaseEdge } from "@xyflow/react";
import { cn } from "@/lib/utils";

const DEFAULT_STROKE_WIDTH = 3;

export interface BaseEdgeProps {
  id: string;
  path: string;
  selected?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  markerStart?: string;
  markerEnd?: string;
  className?: string;
}

const SELECTED_STROKE = "rgb(139 92 246)";

/**
 * Reusable base edge for custom edges: consistent path stroke and selection styling.
 * Use for labeled connector, step, bezier, or any custom edge type.
 */
function BaseEdgeComponent({
  id,
  path,
  selected,
  strokeColor = "#94a3b8",
  strokeWidth = DEFAULT_STROKE_WIDTH,
  strokeDasharray,
  markerStart,
  markerEnd,
  className,
}: BaseEdgeProps) {
  const style: React.CSSProperties = {
    stroke: selected ? SELECTED_STROKE : strokeColor,
    strokeWidth,
    ...(strokeDasharray ? { strokeDasharray } : {}),
  };

  return (
    <ReactFlowBaseEdge
      id={id}
      path={path}
      style={style}
      markerStart={markerStart}
      markerEnd={markerEnd}
      className={cn(className)}
    />
  );
}

export const BaseEdge = memo(BaseEdgeComponent);
