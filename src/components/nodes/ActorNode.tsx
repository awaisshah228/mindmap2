"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_WIDTH = 100;
const DEFAULT_HEIGHT = 100;

function ActorNode({ id, data, selected }: NodeProps) {
  const label = (data.label as string) || "Actor";

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className="flex flex-col items-center"
      style={{ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }}
      minWidth={70}
      minHeight={90}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !-left-1 !top-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !-right-1 !top-1/2 !-translate-y-1/2" />
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !-top-1 !left-1/2 !-translate-x-1/2" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !-bottom-1 !left-1/2 !-translate-x-1/2" />

      <div className="flex flex-col items-center gap-2 flex-1 justify-center">
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center border-2 shrink-0",
            selected ? "border-violet-400 bg-violet-50" : "border-slate-300 bg-slate-50"
          )}
        >
          <User className="w-6 h-6 text-slate-600" />
        </div>
        <div className="nodrag nokey text-center min-w-0 w-full px-1">
          <EditableNodeContent
            nodeId={id}
            value={label}
            placeholder="Actor"
            className="text-xs font-medium text-slate-700 truncate block"
            editOnlyViaToolbar
          />
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(ActorNode);
