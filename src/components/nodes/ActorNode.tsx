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
      <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
      <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />
      <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />

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
