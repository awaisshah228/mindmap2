"use client";

import { memo, useMemo } from "react";
import { useNodes, useEdges, Position, getSmoothStepPath } from "@xyflow/react";

const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 50;

function getHandlePosition(
  node: { position?: { x: number; y: number }; width?: number; height?: number; measured?: { width?: number; height?: number } },
  handle: string
): { x: number; y: number } {
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;
  const w = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
  const h = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
  switch (handle) {
    case "left": return { x, y: y + h / 2 };
    case "right": return { x: x + w, y: y + h / 2 };
    case "top": return { x: x + w / 2, y };
    case "bottom": return { x: x + w / 2, y: y + h };
    default: return { x: x + w / 2, y: y + h / 2 };
  }
}

function parsePathToSegments(pathStr: string): { x1: number; y1: number; x2: number; y2: number }[] {
  const segments: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const commands = pathStr.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
  let x = 0, y = 0;
  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
    if (type === "M" && args.length >= 2) {
      x = args[0]; y = args[1];
    } else if ((type === "L" || type === "V" || type === "H") && args.length >= 1) {
      const x1 = x, y1 = y;
      if (type === "L" && args.length >= 2) { x = args[0]; y = args[1]; }
      else if (type === "H") { x = args[0]; }
      else if (type === "V") { y = args[0]; }
      segments.push({ x1, y1, x2: x, y2: y });
    }
  }
  return segments;
}

function lineIntersection(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): { x: number; y: number } | null {
  const dax = a2.x - a1.x, day = a2.y - a1.y;
  const dbx = b2.x - b1.x, dby = b2.y - b1.y;
  const den = dax * dby - day * dbx;
  if (Math.abs(den) < 1e-10) return null;
  const t = ((b1.x - a1.x) * dby - (b1.y - a1.y) * dbx) / den;
  const u = ((b1.x - a1.x) * day - (b1.y - a1.y) * dax) / den;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: a1.x + t * dax, y: a1.y + t * day };
  }
  return null;
}

function EdgeCrossingMarkersInner() {
  const nodes = useNodes();
  const edges = useEdges();
  const crossings = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    if (edges.length > 35) return [];
    const paths: { id: string; segments: { x1: number; y1: number; x2: number; y2: number }[] }[] = [];
    for (const e of edges) {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) continue;
      const sh = (e.sourceHandle as string) || "right";
      const th = (e.targetHandle as string) || "left";
      const sp = getHandlePosition(src, sh);
      const tp = getHandlePosition(tgt, th);
      const posMap: Record<string, Position> = {
        left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom,
      };
      const [pathStr] = getSmoothStepPath({
        sourceX: sp.x, sourceY: sp.y, targetX: tp.x, targetY: tp.y,
        sourcePosition: posMap[sh] ?? Position.Right,
        targetPosition: posMap[th] ?? Position.Left,
        borderRadius: 5,
      });
      paths.push({ id: e.id, segments: parsePathToSegments(pathStr || "") });
    }
    const result: { x: number; y: number }[] = [];
    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        for (const sa of paths[i].segments) {
          for (const sb of paths[j].segments) {
            const pt = lineIntersection(
              { x: sa.x1, y: sa.y1 }, { x: sa.x2, y: sa.y2 },
              { x: sb.x1, y: sb.y1 }, { x: sb.x2, y: sb.y2 }
            );
            if (pt) result.push(pt);
          }
        }
      }
    }
    return result;
  }, [nodes, edges]);

  if (crossings.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 5 }}>
      {crossings.map((pt, i) => (
        <div
          key={`${pt.x}-${pt.y}-${i}`}
          className="absolute w-2 h-2 rotate-45 rounded-sm bg-amber-400/90 border border-amber-600"
          style={{
            left: pt.x - 4,
            top: pt.y - 4,
            width: 8,
            height: 8,
            transform: "translate(-50%, -50%) rotate(45deg)",
          }}
          title="Edge crossing"
        />
      ))}
    </div>
  );
}

export const EdgeCrossingMarkers = memo(EdgeCrossingMarkersInner);
