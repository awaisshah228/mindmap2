"use client";

import type { PointerEvent } from "react";
import { useRef, useState } from "react";
import getStroke from "perfect-freehand";

import type { Stroke } from "./FreeDrawPreview";

type StrokePoint = [number, number, number];
type Points = StrokePoint[];

const FREEHAND_COLOR = "#000000";
const FREEHAND_SIZE = 8;

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

type FreehandOverlayProps = {
  onStrokeComplete: (stroke: Stroke) => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  zoom: number;
};

export function FreehandOverlay({
  onStrokeComplete,
  screenToFlowPosition,
  zoom,
}: FreehandOverlayProps) {

  const pointsRef = useRef<Points>([]);
  const [points, setPoints] = useState<Points>([]);

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const screenX = e.clientX;
    const screenY = e.clientY;
    const localX = screenX - rect.left;
    const localY = screenY - rect.top;

    const nextPoints: Points = [
      ...pointsRef.current,
      [localX, localY, e.pressure || 0.5],
    ];
    pointsRef.current = nextPoints;
    setPoints(nextPoints);
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;

    const currentPoints = pointsRef.current;
    if (!currentPoints.length) return;

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const screenX = e.clientX;
    const screenY = e.clientY;
    const localX = screenX - rect.left;
    const localY = screenY - rect.top;

    const last = currentPoints[currentPoints.length - 1];
    const dx = localX - last[0];
    const dy = localY - last[1];
    const MIN_DIST_SQ = 4; // ~2px, helps avoid excessive points but keeps things smooth
    if (dx * dx + dy * dy < MIN_DIST_SQ) return;

    const nextPoints: Points = [
      ...currentPoints,
      [localX, localY, e.pressure || 0.5],
    ];
    pointsRef.current = nextPoints;
    setPoints(nextPoints);
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);

    const currentPoints = pointsRef.current;

    if (currentPoints.length > 2) {
      // Convert local coordinates back to screen, then to flow coordinates
      const flowPoints: StrokePoint[] = currentPoints.map(([lx, ly, p]) => {
        // Reconstruct approximate screen coordinates using the latest rect
        // Since rect might have moved slightly, use current target rect.
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const sx = lx + rect.left;
        const sy = ly + rect.top;
        const flow = screenToFlowPosition({ x: sx, y: sy });
        return [flow.x, flow.y, p ?? 0.5];
      });

      const stroke: Stroke = {
        id: `stroke-${Date.now()}`,
        points: flowPoints,
        color: FREEHAND_COLOR,
        size: FREEHAND_SIZE,
      };

      onStrokeComplete(stroke);
    }

    pointsRef.current = [];
    setPoints([]);
  }

  // Build a simple smooth path directly in screen space for the live preview
  const pathData =
    points.length > 1
      ? getSvgPathFromStroke(
          getStroke(points, {
            size: FREEHAND_SIZE * zoom,
            thinning: 0.6,
            smoothing: 0.7,
            streamline: 0.7,
            easing: (t) => t,
            start: { taper: 0, cap: true },
            end: { taper: 0, cap: true },
          })
        )
      : "";

  return (
    <div
      className="absolute inset-0 z-[5] cursor-crosshair"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {points.length > 1 && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <path d={pathData} fill={FREEHAND_COLOR} stroke="none" />
        </svg>
      )}
    </div>
  );
}

