"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { Server } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 72;

function ServiceNode({ id, data, selected }: NodeProps) {
  const label = (data.label as string) || "Service";
  const subtitle = (data.subtitle as string) || ""; // e.g. "POST /api/users"

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className={cn(
        "rounded-xl border-2 overflow-visible",
        selected ? "border-violet-400" : "border-slate-300"
      )}
      style={{ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }}
      minWidth={100}
      minHeight={56}
    >
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !-left-1 !top-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !-right-1 !top-1/2 !-translate-y-1/2" />
      <Handle type="target" position={Position.Top} id="top" className="!w-2 !h-2 !-top-1 !left-1/2 !-translate-x-1/2" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !-bottom-1 !left-1/2 !-translate-x-1/2" />

      <div className="h-full flex items-center gap-3 px-4 py-2 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
          <Server className="w-5 h-5 text-violet-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="nodrag nokey">
            <EditableNodeContent
              nodeId={id}
              value={label}
              placeholder="Service name"
              className="text-sm font-semibold text-slate-800 truncate"
              editOnlyViaToolbar
            />
          </div>
          {subtitle && (
            <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">{subtitle}</p>
          )}
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(ServiceNode);
