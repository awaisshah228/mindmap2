"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { getIconById } from "@/lib/icon-registry";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { cn } from "@/lib/utils";

interface IconNodeData {
  iconId?: string;
  emoji?: string;
  customIcon?: string;
  iconUrl?: string;
  label?: string;
}

function IconNode({ id, data, selected }: NodeProps) {
  const { iconId, emoji, customIcon, iconUrl, label } = (data || {}) as unknown as IconNodeData;
  const def = iconId ? getIconById(iconId) : null;
  const IconComponent = def?.Icon;
  const { updateNodeData } = useReactFlow();
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelInput, setLabelInput] = useState(label ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingLabel) inputRef.current?.focus();
  }, [editingLabel]);

  const commitLabel = () => {
    const trimmed = labelInput.trim();
    pushUndo();
    updateNodeData(id, { label: trimmed || undefined });
    setEditingLabel(false);
  };

  const showLabel = label != null && label !== "";
  const minHeight = showLabel || selected ? 64 + 24 : 64;

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className="bg-transparent flex flex-col items-center justify-start"
      style={{ width: 64, minHeight }}
    >
      {/* Connection handles on all 4 sides */}
      <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />
      <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
      <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />

      <div className="w-full shrink-0 flex items-center justify-center" style={{ height: 64 }}>
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

      {/* Custom label: show as text or editable input when selected */}
      {(showLabel || selected) && (
        <div className="w-full min-h-[20px] px-0.5 pb-0.5 flex items-center justify-center">
          {editingLabel ? (
            <input
              ref={inputRef}
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => { if (e.key === "Enter") commitLabel(); if (e.key === "Escape") { setLabelInput(label ?? ""); setEditingLabel(false); } }}
              className="w-full min-w-0 text-[10px] text-center rounded border border-violet-400 bg-white dark:bg-gray-800 dark:text-gray-200 px-1 py-0.5 focus:ring-1 focus:ring-violet-500 focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLabelInput(label ?? ""); setEditingLabel(true); }}
              className={cn(
                "w-full min-w-0 text-[10px] truncate text-center rounded px-1 py-0.5 transition-colors",
                showLabel ? "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              )}
            >
              {showLabel ? label : "Add label"}
            </button>
          )}
        </div>
      )}
    </BaseNode>
  );
}

export default memo(IconNode);

