"use client";

import { useViewport } from "@xyflow/react";
import getStroke from "perfect-freehand";

export type StrokePoint = [number, number, number];

export interface Stroke {
  id?: string;
  points: StrokePoint[];
  color: string;
  size: number;
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

function renderStroke(
  stroke: Stroke,
  viewport: { x: number; y: number; zoom: number }
): string {
  const points = stroke.points.map(([x, y, pressure]) => [
    x * viewport.zoom + viewport.x,
    y * viewport.zoom + viewport.y,
    pressure,
  ]);

  const outlinePoints = getStroke(points, {
    size: stroke.size * viewport.zoom,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    easing: (t) => t,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
  });

  return getSvgPathFromStroke(outlinePoints);
}

interface FreeDrawPreviewProps {
  currentStroke?: Stroke | null;
}

export function FreeDrawPreview({ currentStroke }: FreeDrawPreviewProps) {
  const viewport = useViewport();

  if (!currentStroke || currentStroke.points.length < 2) return null;

  const pathData = renderStroke(currentStroke, viewport);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    >
      <path d={pathData} fill={currentStroke.color} stroke="none" />
    </svg>
  );
}
