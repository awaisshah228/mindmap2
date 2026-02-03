"use client";

import { memo } from "react";
import { type NodeProps, NodeResizer } from "@xyflow/react";
import getStroke from "perfect-freehand";
import { NodeInlineToolbar } from "@/components/toolbar/NodeInlineToolbar";

export type StrokePoint = [number, number, number];

export interface FreeDrawNodeData {
  points: StrokePoint[];
  color?: string;
  strokeSize?: number;
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

function FreeDrawNode({ id, data, selected }: NodeProps) {
  const { points = [], color = "#000000", strokeSize = 8 } = (data || {}) as unknown as FreeDrawNodeData;

  if (!points.length) return null;

  const bounds = getBounds(points);
  const padding = (strokeSize || 8) + 4;
  const width = bounds.maxX - bounds.minX + padding * 2;
  const height = bounds.maxY - bounds.minY + padding * 2;

  const normalizedPoints = points.map(([x, y, pressure]) => [
    x - bounds.minX + padding,
    y - bounds.minY + padding,
    pressure,
  ]);

  const outlinePoints = getStroke(normalizedPoints, {
    size: strokeSize || 8,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t) => t,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
  });

  const pathData = getSvgPathFromStroke(outlinePoints);

  return (
    <>
      <NodeInlineToolbar nodeId={id} />
      {selected && (
        <NodeResizer
          minWidth={20}
          minHeight={20}
          keepAspectRatio={false}
          lineClassName="!border-violet-400"
          handleClassName="!w-2 !h-2 !bg-violet-500 !border-white"
        />
      )}
      <div
        className="nodrag nokey"
        style={{ width, height, minWidth: 20, minHeight: 20 }}
      >
        <svg
          width="100%"
          height="100%"
          style={{ overflow: "visible" }}
          className={selected ? "ring-2 ring-violet-400 rounded" : ""}
        >
          <path
            d={pathData}
            fill={color}
            stroke="none"
          />
        </svg>
      </div>
    </>
  );
}

export default memo(FreeDrawNode);
