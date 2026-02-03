"use client";

import { memo, useMemo } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import getStroke from "perfect-freehand";
import { useCanvasStore } from "@/lib/store/canvas-store";

export type StrokePoint = [number, number, number];

export interface FreeDrawNodeData {
  points: StrokePoint[];
  color?: string;
  strokeSize?: number;
  initialSize?: { width: number; height: number };
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"] as (string | number)[]
  );
  d.push("Z");
  return d.join(" ");
}

function getBounds(points: StrokePoint[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function FreeDrawNode({ id, data, width, height, selected, dragging }: NodeProps) {
  const { points = [], color = "#000000", strokeSize = 8, initialSize } =
    (data || {}) as unknown as FreeDrawNodeData;
  const pushUndo = useCanvasStore((s) => s.pushUndo);

  if (!points.length) return null;

  const baseWidth = initialSize?.width;
  const baseHeight = initialSize?.height;

  const scaleX = baseWidth && width ? width / baseWidth : 1;
  const scaleY = baseHeight && height ? height / baseHeight : 1;

  const normalizedPoints = useMemo(
    () =>
      points.map(([x, y, pressure]) => [x * scaleX, y * scaleY, pressure] as StrokePoint),
    [points, scaleX, scaleY]
  );

  const outlinePoints = getStroke(normalizedPoints, {
    size: strokeSize || 8,
    thinning: 0.6,
    smoothing: 0.7,
    streamline: 0.7,
    easing: (t) => t,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
  });

  const pathData = getSvgPathFromStroke(outlinePoints);

  return (
    <>
      {selected && (
        <NodeResizer
          nodeId={id}
          isVisible={selected && !dragging}
          minWidth={20}
          minHeight={20}
          keepAspectRatio={false}
          color="rgb(139 92 246)"
          lineClassName="!border-violet-400"
          handleClassName="!w-2 !h-2 !bg-violet-500 !border-white"
          onResizeStart={() => pushUndo()}
        />
      )}
      <div
        className="relative"
        style={{ width: width ?? baseWidth ?? 20, height: height ?? baseHeight ?? 20, minWidth: 20, minHeight: 20 }}
      >
        <svg
          width="100%"
          height="100%"
          style={{ overflow: "visible", cursor: "move" }}
        >
          <path d={pathData} fill={color} stroke="none" />
        </svg>
      </div>
    </>
  );
}

export default memo(FreeDrawNode);
