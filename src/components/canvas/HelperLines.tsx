"use client";

import { useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";

const LINE_COLOR = "rgb(139 92 246)";
const LINE_WIDTH = 1;

interface HelperLinesProps {
  horizontal: { y: number; x1: number; x2: number } | null;
  vertical: { x: number; y1: number; y2: number } | null;
}

export function HelperLines({ horizontal, vertical }: HelperLinesProps) {
  const { getViewport } = useReactFlow();
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    const update = () => setViewport(getViewport());
    update();
    let rafId = requestAnimationFrame(function tick() {
      update();
      rafId = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(rafId);
  }, [getViewport]);

  if (!horizontal && !vertical) return null;

  const toScreen = (x: number, y: number) => ({
    x: x * viewport.zoom + viewport.x,
    y: y * viewport.zoom + viewport.y,
  });

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    >
      {horizontal && (
        <line
          x1={toScreen(horizontal.x1, horizontal.y).x}
          y1={toScreen(horizontal.x1, horizontal.y).y}
          x2={toScreen(horizontal.x2, horizontal.y).x}
          y2={toScreen(horizontal.x2, horizontal.y).y}
          stroke={LINE_COLOR}
          strokeWidth={LINE_WIDTH}
          strokeDasharray="4 4"
        />
      )}
      {vertical && (
        <line
          x1={toScreen(vertical.x, vertical.y1).x}
          y1={toScreen(vertical.x, vertical.y1).y}
          x2={toScreen(vertical.x, vertical.y2).x}
          y2={toScreen(vertical.x, vertical.y2).y}
          stroke={LINE_COLOR}
          strokeWidth={LINE_WIDTH}
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
}
