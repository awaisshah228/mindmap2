"use client";

import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { getIconById } from "@/lib/icon-registry";

interface IconNodeData {
  iconId?: string;
  emoji?: string;
  customIcon?: string;
}

function IconNode({ id, data, selected }: NodeProps) {
  const { iconId, emoji, customIcon } = (data || {}) as unknown as IconNodeData;
  const def = iconId ? getIconById(iconId) : null;
  const IconComponent = def?.Icon;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className="bg-transparent flex items-center justify-center"
      style={{ width: 64, height: 64 }}
    >
      <div className="w-full h-full flex items-center justify-center">
        {customIcon ? (
          <img src={customIcon} alt="" className="max-w-full max-h-full object-contain" />
        ) : emoji ? (
          <span className="text-4xl leading-none select-none">{emoji}</span>
        ) : IconComponent ? (
          <IconComponent className="w-3/4 h-3/4" />
        ) : null}
      </div>
    </BaseNode>
  );
}

export default memo(IconNode);

