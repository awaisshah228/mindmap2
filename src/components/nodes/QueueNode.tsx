"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_WIDTH = 140;
const DEFAULT_HEIGHT = 64;

function QueueNode({ id, data, selected }: NodeProps) {
  const label = (data.label as string) || "Queue";

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className={cn(
        "rounded-lg border-2 overflow-hidden",
        selected ? "border-emerald-500" : "border-emerald-400/60"
      )}
      style={{ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }}
      minWidth={90}
      minHeight={50}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !-left-1 !top-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !-right-1 !top-1/2 !-translate-y-1/2" />
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !-top-1 !left-1/2 !-translate-x-1/2" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !-bottom-1 !left-1/2 !-translate-x-1/2" />

      <div className="h-full flex items-center gap-3 px-3 py-2 bg-gradient-to-br from-emerald-50 to-emerald-100/80">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-200/80 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-emerald-700" />
        </div>
        <div className="nodrag nokey min-w-0 flex-1">
          <EditableNodeContent
            nodeId={id}
            value={label}
            placeholder="Queue / Topic"
            className="text-sm font-semibold text-emerald-900 truncate"
            editOnlyViaToolbar
          />
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(QueueNode);
