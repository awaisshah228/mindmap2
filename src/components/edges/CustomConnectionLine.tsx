"use client";

import {
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  type ConnectionLineComponentProps,
} from "@xyflow/react";

/**
 * Custom connection line shown while dragging from a handle to connect.
 * Matches our edge style; path type follows connectionLineType (Bezier, Straight, Smooth step).
 */
export function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionLineType,
  connectionStatus,
}: ConnectionLineComponentProps) {
  const params = {
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
    sourcePosition: fromPosition,
    targetPosition: toPosition,
  };

  const path =
    connectionLineType === "straight"
      ? getStraightPath(params)[0]
      : connectionLineType === "smoothstep"
        ? getSmoothStepPath({ ...params, borderRadius: 8 })[0]
        : getBezierPath(params)[0];

  const stroke =
    connectionStatus === "invalid" ? "rgb(239 68 68)" : "rgb(139 92 246)";

  return (
    <g>
      <path
        fill="none"
        d={path}
        stroke={stroke}
        strokeWidth={2}
        className="animated"
      />
    </g>
  );
}
