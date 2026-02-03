"use client";

import { useViewport } from "@xyflow/react";

interface Point {
  x: number;
  y: number;
}

interface EraserPreviewProps {
  points: Point[];
}

export function EraserPreview({ points }: EraserPreviewProps) {
  const viewport = useViewport();

  if (!points || points.length < 2) return null;

  const toScreen = (p: Point) => ({
    x: p.x * viewport.zoom + viewport.x,
    y: p.y * viewport.zoom + viewport.y,
  });

  const screenPoints = points.map(toScreen);
  const d = screenPoints
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 8 }}>
      <path
        d={d}
        fill="none"
        stroke="#ef4444"
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.7}
      />
    </svg>
  );
}

