"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { getIconById } from "@/lib/icon-registry";

interface IconNodeData {
  iconId?: string;
  emoji?: string;
  customIcon?: string;
  iconUrl?: string;
}

function IconNode({ id, data, selected }: NodeProps) {
  const { iconId, emoji, customIcon, iconUrl } = (data || {}) as unknown as IconNodeData;
  const def = iconId ? getIconById(iconId) : null;
  const IconComponent = def?.Icon;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className="bg-transparent flex items-center justify-center"
      style={{ width: 64, height: 64 }}
    >
      {/* Connection handles on all 4 sides */}
      <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />
      <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
      <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />

      <div className="w-full h-full flex items-center justify-center">
        {customIcon ? (
          <img src={customIcon} alt="" className="max-w-full max-h-full object-contain" />
        ) : IconComponent ? (
          <IconComponent className="w-3/4 h-3/4" />
        ) : iconUrl ? (
          <img src={iconUrl} alt="" className="max-w-full max-h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : emoji ? (
          <span className="text-4xl leading-none select-none">{emoji}</span>
        ) : null}
      </div>
    </BaseNode>
  );
}

export default memo(IconNode);

