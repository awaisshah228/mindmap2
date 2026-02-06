"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIconById } from "@/lib/icon-registry";

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 72;

function ServiceNode({ id, data, selected }: NodeProps) {
  const label = (data.label as string) || "Service";
  const subtitle = (data.subtitle as string) || ""; // e.g. "POST /api/users"
  const iconDef = getIconById(data.icon as string);
  const IconComp = iconDef?.Icon;
  const iconUrl = data.iconUrl as string | undefined;
  const customIcon = data.customIcon as string | undefined;
  const emoji = data.emoji as string | undefined;

  const renderIcon = () => {
    if (customIcon) return <img src={customIcon} alt="" className="w-5 h-5 object-contain" />;
    if (IconComp) return <IconComp className="w-5 h-5 text-violet-600" />;
    if (iconUrl) return <img src={iconUrl} alt="" className="w-5 h-5 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
    if (emoji) return <span className="text-lg leading-none">{emoji}</span>;
    return <Server className="w-5 h-5 text-violet-600" />;
  };

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
      <Handle type="source" position={Position.Left} id="left" className="node-connect-handle" />
      <Handle type="source" position={Position.Right} id="right" className="node-connect-handle" />
      <Handle type="source" position={Position.Top} id="top" className="node-connect-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="node-connect-handle" />

      <div className="h-full flex items-center gap-3 px-4 py-2 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
          {renderIcon()}
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
