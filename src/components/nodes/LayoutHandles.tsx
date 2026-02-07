"use client";

import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { getMultiHandleId, getHandleIds, type LayoutDirection } from "@/lib/layout-engine";

export interface LayoutHandlesProps {
  nodeId: string;
  direction: LayoutDirection;
  sourceCount: number;
  targetCount: number;
}

/**
 * Renders multiple handles per side for ELK multi-port layout.
 * Spreads handles along the source/target edges to reduce edge crossings.
 * @see https://reactflow.dev/examples/layout/elkjs-multiple-handles
 */
function LayoutHandlesInner({ nodeId, direction, sourceCount, targetCount }: LayoutHandlesProps) {
  const { source: sourceBase, target: targetBase } = getHandleIds(direction);
  const handles: React.ReactElement[] = [];

  for (let i = 0; i < sourceCount; i++) {
    const id = getMultiHandleId(sourceBase, i);
    const pos = direction === "LR" || direction === "RL" ? Position.Right : Position.Bottom;
    handles.push(
      <Handle
        key={`src-${id}`}
        id={id}
        type="source"
        position={pos}
        className="node-connect-handle"
        style={
          sourceCount > 1
            ? {
                top: direction === "LR" || direction === "RL" ? `${((i + 1) / (sourceCount + 1)) * 100}%` : undefined,
                left: direction === "TB" || direction === "BT" ? `${((i + 1) / (sourceCount + 1)) * 100}%` : undefined,
              }
            : undefined
        }
      />
    );
  }

  for (let i = 0; i < targetCount; i++) {
    const id = getMultiHandleId(targetBase, i);
    const pos = direction === "LR" || direction === "RL" ? Position.Left : Position.Top;
    handles.push(
      <Handle
        key={`tgt-${id}`}
        id={id}
        type="source"
        position={pos}
        className="node-connect-handle"
        style={
          targetCount > 1
            ? {
                top: direction === "LR" || direction === "RL" ? `${((i + 1) / (targetCount + 1)) * 100}%` : undefined,
                left: direction === "TB" || direction === "BT" ? `${((i + 1) / (targetCount + 1)) * 100}%` : undefined,
              }
            : undefined
        }
      />
    );
  }

  return <>{handles}</>;
}

export const LayoutHandles = memo(LayoutHandlesInner);
