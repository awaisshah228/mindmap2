"use client";

import { memo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { LayoutHandles } from "./LayoutHandles";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIconById } from "@/lib/icon-registry";
import type { LayoutDirection } from "@/lib/layout-engine";

const DEFAULT_WIDTH = 140;
const DEFAULT_HEIGHT = 64;

function QueueNode({ id, data, selected }: NodeProps) {
  const label = (data.label as string) || "Queue";
  const iconDef = getIconById(data.icon as string);
  const IconComp = iconDef?.Icon;
  const iconUrl = data.iconUrl as string | undefined;
  const emoji = data.emoji as string | undefined;
  const layoutHandles = data.layoutHandles as { source: number; target: number } | undefined;
  const layoutDir = (data.layoutDirection as LayoutDirection) ?? "LR";

  const renderHandles = () => {
    if (layoutHandles && layoutHandles.source >= 1 && layoutHandles.target >= 1) {
      return (
        <LayoutHandles nodeId={id} direction={layoutDir} sourceCount={layoutHandles.source} targetCount={layoutHandles.target} />
      );
    }
    return (
      <>
        <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
        <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />
        <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
        <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />
      </>
    );
  };

  const renderIcon = () => {
    if (IconComp) return <IconComp className="w-4 h-4 text-emerald-700" />;
    if (iconUrl) return <img src={iconUrl} alt="" className="w-4 h-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
    if (emoji) return <span className="text-base leading-none">{emoji}</span>;
    return <MessageSquare className="w-4 h-4 text-emerald-700" />;
  };

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
      {renderHandles()}

      <div className="h-full flex items-center gap-3 px-3 py-2 bg-gradient-to-br from-emerald-50 to-emerald-100/80">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-200/80 flex items-center justify-center">
          {renderIcon()}
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
