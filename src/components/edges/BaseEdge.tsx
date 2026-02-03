"use client";

import { memo } from "react";
import { BaseEdge as ReactFlowBaseEdge, type EdgeMarker } from "@xyflow/react";
import { cn } from "@/lib/utils";

const DEFAULT_STROKE_WIDTH = 4;

export interface BaseEdgeProps {
  id: string;
  path: string;
  selected?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  markerStart?: EdgeMarker | string;
  markerEnd?: EdgeMarker | string;
  className?: string;
  onMouseEnter?: React.MouseEventHandler<SVGPathElement>;
  onMouseLeave?: React.MouseEventHandler<SVGPathElement>;
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
  onMouseEnter,
  onMouseLeave,
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(className)}
    />
  );
}

export const BaseEdge = memo(BaseEdgeComponent);
