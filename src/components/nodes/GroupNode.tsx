"use client";

import { memo, useState, useCallback, useRef } from "react";
import { Handle, Position, type NodeProps, NodeResizer, useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";

const MIN_GROUP_WIDTH = 180;
const MIN_GROUP_HEIGHT = 120;

// Preset group colors
const GROUP_COLORS: { bg: string; border: string; header: string; text: string }[] = [
  { bg: "bg-slate-100/90", border: "border-slate-300", header: "bg-slate-200/80", text: "text-slate-700" },
  { bg: "bg-blue-50/90", border: "border-blue-200", header: "bg-blue-100/80", text: "text-blue-700" },
  { bg: "bg-green-50/90", border: "border-green-200", header: "bg-green-100/80", text: "text-green-700" },
  { bg: "bg-amber-50/90", border: "border-amber-200", header: "bg-amber-100/80", text: "text-amber-700" },
  { bg: "bg-violet-50/90", border: "border-violet-200", header: "bg-violet-100/80", text: "text-violet-700" },
  { bg: "bg-rose-50/90", border: "border-rose-200", header: "bg-rose-100/80", text: "text-rose-700" },
];

/**
 * Subflow / group container node. Resizable; child nodes use parentId pointing to this node's id.
 * Any node type (shape, image, icon, etc.) can be a child when dropped inside.
 * Features: editable label, color presets, connection handles.
 */
function GroupNode({ id, data, selected }: NodeProps) {
  const label = (data.label as string) || "Group";
  const hoveredGroupId = (data.hoveredGroupId as string) ?? null;
  const isHovered = hoveredGroupId === id;
  const colorIdx = (data.colorIdx as number) ?? 0;
  const color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];

  const { updateNodeData } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevLabelRef = useRef(label);

  // Sync label changes from outside without calling setState in an effect
  if (prevLabelRef.current !== label && !isEditing) {
    prevLabelRef.current = label;
    setEditValue(label);
  }

  const handleSave = useCallback(() => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      updateNodeData(id, { label: trimmed });
    }
  }, [id, editValue, label, updateNodeData]);

  return (
    <>
      <NodeResizer
        nodeId={id}
        isVisible={selected}
        minWidth={MIN_GROUP_WIDTH}
        minHeight={MIN_GROUP_HEIGHT}
        color="rgb(139 92 246)"
        lineClassName="!border-2 !border-violet-400 !bg-transparent"
        handleClassName="!w-3 !h-3 !min-w-3 !min-h-3 !rounded-none !bg-white !border-2 !border-violet-400 !shadow-sm hover:!bg-gray-50"
      />
      {/* Connection handles */}
      <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />
      <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
      <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />
      <div
        className={cn(
          "rounded-xl border-2 overflow-hidden w-full h-full transition-colors",
          color.bg,
          selected ? "border-violet-400 ring-2 ring-violet-200" : color.border,
          isHovered && !selected && "border-violet-300 bg-violet-50/80 ring-2 ring-violet-200/60"
        )}
        style={{ minWidth: MIN_GROUP_WIDTH, minHeight: MIN_GROUP_HEIGHT }}
      >
        <div className={cn("px-3 py-2 border-b border-slate-300/50 flex items-center gap-2", color.header)}>
          {isEditing ? (
            <input
              ref={inputRef}
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") setIsEditing(false);
              }}
              className="flex-1 text-xs font-semibold bg-white/80 border border-violet-300 rounded px-1.5 py-0.5 outline-none ring-1 ring-violet-200 nodrag"
            />
          ) : (
            <span
              className={cn("flex-1 text-xs font-semibold truncate", color.text)}
              onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
              {label}
            </span>
          )}
          {/* Color dots — only when selected */}
          {selected && !isEditing && (
            <div className="flex items-center gap-0.5 nodrag">
              {GROUP_COLORS.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); updateNodeData(id, { colorIdx: i }); }}
                  className={cn(
                    "w-3 h-3 rounded-full border transition-transform hover:scale-125",
                    c.header.replace("/80", ""),
                    i === colorIdx ? "ring-2 ring-violet-400 ring-offset-1" : "border-gray-300/50"
                  )}
                  title={`Color ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="w-full h-[calc(100%-32px)]" />
      </div>
    </>
  );
}

export default memo(GroupNode);
