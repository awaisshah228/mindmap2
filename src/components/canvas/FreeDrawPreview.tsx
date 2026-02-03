"use client";

import { useViewport } from "@xyflow/react";

export type StrokePoint = [number, number, number];

export interface Stroke {
  id?: string;
  points: StrokePoint[];
  color: string;
  size: number;
}

interface FreeDrawPreviewProps {
  currentStroke?: Stroke | null;
}

export function FreeDrawPreview({ currentStroke }: FreeDrawPreviewProps) {
  const viewport = useViewport();

  if (!currentStroke || currentStroke.points.length < 2) return null;

  const toScreen = (x: number, y: number) => ({
    x: x * viewport.zoom + viewport.x,
    y: y * viewport.zoom + viewport.y,
  });

  const pathData = currentStroke.points
    .map(([x, y], index) => {
      const p = toScreen(x, y);
      return `${index === 0 ? "M" : "L"}${p.x},${p.y}`;
    })
    .join(" ");

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    >
      <path
        d={pathData}
        fill="none"
        stroke={currentStroke.color}
        strokeWidth={currentStroke.size * viewport.zoom}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
