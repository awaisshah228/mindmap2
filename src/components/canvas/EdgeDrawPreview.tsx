"use client";

import { useViewport } from "@xyflow/react";

interface EdgeDrawPreviewProps {
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  /** Optional intermediate points (in flow coordinates) to show multi-step path following the drag. */
  points?: { x: number; y: number }[];
}

export function EdgeDrawPreview({ start, end, points }: EdgeDrawPreviewProps) {
  const viewport = useViewport();

  if (!start || !end) return null;

  const toScreen = (p: { x: number; y: number }) => ({
    x: p.x * viewport.zoom + viewport.x,
    y: p.y * viewport.zoom + viewport.y,
  });

  const flowPoints = [start, ...(points ?? []), end];
  const screenPoints = flowPoints.map(toScreen);
  const pointsAttr = screenPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    >
      <polyline
        points={pointsAttr}
        fill="none"
        stroke="rgb(139 92 246)"
        strokeWidth={2}
        strokeDasharray="4 4"
      />
    </svg>
  );
}
