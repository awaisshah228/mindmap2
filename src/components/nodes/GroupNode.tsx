"use client";

import { memo, useState, useCallback, useRef } from "react";
import { Handle, Position, type NodeProps, NodeResizer, NodeToolbar, useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { getIconById } from "@/lib/icon-registry";
import { IconPickerPanel } from "@/components/panels/IconPickerPanel";
import {
  Bold,
  Italic,
  Type,
  Pencil,
  Copy,
  Trash2,
  FileText,
  Tag,
  Smile,
  ChevronDown,
  Ungroup,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";

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

const FONT_SIZES: { value: string; label: string }[] = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "S" },
  { value: "base", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
];

const FONT_SIZE_CLASSES: Record<string, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  base: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

/**
 * Subflow / group container node. Resizable; child nodes use parentId pointing to this node's id.
 * Any node type (shape, image, icon, etc.) can be a child when dropped inside.
 * Features: editable label, color presets, connection handles, icon/emoji, toolbar.
 */
function GroupNode({ id, data: dataProp, selected }: NodeProps) {
  const data = dataProp ?? {};
  const label = (data.label as string) || "Group";
  const description = (data.description as string) ?? "";
  const hoveredGroupId = (data.hoveredGroupId as string) ?? null;
  const isHovered = hoveredGroupId === id;
  const colorIdx = (data.colorIdx as number) ?? 0;
  const color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];

  // Icon / emoji
  const iconId = (data.icon as string) ?? null;
  const emoji = (data.emoji as string) ?? null;
  const customIcon = (data.customIcon as string) ?? null;
  const iconUrl = (data.iconUrl as string) ?? null;
  const iconDef = iconId ? getIconById(iconId) : null;

  // Text formatting
  const fontWeight = (data.fontWeight as string) ?? "normal";
  const fontStyle = (data.fontStyle as string) ?? "normal";
  const fontSize = (data.fontSize as string) ?? "sm";

  const { updateNodeData, getNode, getNodes, setNodes, deleteElements } = useReactFlow();
  const node = getNode(id);
  const nodeWidth = node?.style && typeof node.style.width === "number" ? node.style.width : undefined;
  const nodeHeight = node?.style && typeof node.style.height === "number" ? node.style.height : undefined;
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const hoveredNodeId = useCanvasStore((s) => s.hoveredNodeId);
  const setHoveredNodeId = useCanvasStore((s) => s.setHoveredNodeId);
  const setDetailsPanelNodeId = useCanvasStore((s) => s.setDetailsPanelNodeId);
  const presentationMode = useCanvasStore((s) => s.presentationMode);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevLabelRef = useRef(label);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(description);
  const prevDescRef = useRef(description);

  const [fontSizeOpen, setFontSizeOpen] = useState(false);

  // Sync label changes from outside without calling setState in an effect
  if (prevLabelRef.current !== label && !isEditing) {
    prevLabelRef.current = label;
    setEditValue(label);
  }
  if (prevDescRef.current !== description && !isEditingDesc) {
    prevDescRef.current = description;
    setDescValue(description);
  }

  const handleSave = useCallback(() => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      updateNodeData(id, { label: trimmed });
    }
  }, [id, editValue, label, updateNodeData]);

  const handleDescSave = useCallback(() => {
    setIsEditingDesc(false);
    const trimmed = descValue.trim();
    if (trimmed !== description) {
      updateNodeData(id, { description: trimmed || undefined });
    }
  }, [id, descValue, description, updateNodeData]);

  // When 2+ nodes selected (e.g. Ctrl+A), hide toolbar for all — no toolbar even on hover. Single selection or none: show on hover or when this node is selected.
  const selectedCount = getNodes().filter((n) => n.selected).length;
  const toolbarVisible = selectedCount <= 1 && (hoveredNodeId === id || (selected && selectedCount === 1));

  // ── Toolbar handlers ──
  const handleBold = () => { pushUndo(); updateNodeData(id, { fontWeight: fontWeight === "bold" ? "normal" : "bold" }); };
  const handleItalic = () => { pushUndo(); updateNodeData(id, { fontStyle: fontStyle === "italic" ? "normal" : "italic" }); };
  const handleFontSize = (size: string) => { pushUndo(); updateNodeData(id, { fontSize: size }); setFontSizeOpen(false); };
  const handleIconChange = (newIconId: string | null) => { pushUndo(); updateNodeData(id, { icon: newIconId ?? undefined, emoji: undefined, customIcon: undefined }); };
  const handleCustomIconChange = (dataUrl: string | null) => { pushUndo(); updateNodeData(id, { customIcon: dataUrl ?? undefined, icon: undefined, emoji: undefined }); };
  const handleDuplicate = () => {
    const node = getNode(id);
    if (!node) return;
    pushUndo();
    const newId = `group-${Date.now()}`;
    setNodes((nds) => [...nds, { ...node, id: newId, position: { x: node.position.x + 30, y: node.position.y + 30 }, data: { ...node.data } }]);
  };
  const handleDelete = () => { pushUndo(); deleteElements({ nodes: [{ id }] }); };
  const handleOpenDetails = () => setDetailsPanelNodeId(id);
  const handleUngroup = () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "g", metaKey: true, ctrlKey: true, shiftKey: true, bubbles: true }));
  };

  // Annotation label
  const annotation = (data.annotation as string) ?? "";

  // Render icon in header
  const renderIcon = () => {
    if (customIcon) return <img src={customIcon} alt="" className="w-4 h-4 object-contain rounded-sm shrink-0" />;
    if (iconDef) {
      const IconComp = iconDef.Icon;
      return <IconComp className="w-4 h-4 shrink-0" />;
    }
    if (iconUrl) return <img src={iconUrl} alt="" className="w-4 h-4 object-contain rounded-sm shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
    if (emoji) return <span className="text-sm leading-none select-none shrink-0">{emoji}</span>;
    return null;
  };

  const fontSizeCls = FONT_SIZE_CLASSES[fontSize] ?? "text-xs";

  return (
    <>
      {/* ── Group Toolbar ── */}
      {!presentationMode && (
        <NodeToolbar position={Position.Top} offset={8} align="center" isVisible={toolbarVisible}>
          <div
            className="flex flex-wrap items-center gap-0.5 bg-gray-800 text-gray-200 rounded-lg px-1 py-1 shadow-lg border border-gray-700"
            onMouseEnter={() => setHoveredNodeId(id)}
            onMouseLeave={() => setHoveredNodeId(null)}
          >
            {/* Icon picker */}
            <IconPickerPanel
              value={iconId}
              onChange={handleIconChange}
              customIcon={customIcon}
              onCustomIconChange={handleCustomIconChange}
              trigger={
                <button
                  type="button"
                  title="Add icon / emoji"
                  className="p-1.5 rounded hover:bg-gray-600 transition-colors flex items-center gap-0.5"
                  aria-label="Add icon"
                >
                  <Smile className="w-3.5 h-3.5" />
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>
              }
            />
            <div className="w-px h-4 bg-gray-600 mx-0.5" />
            {/* Bold / Italic */}
            <button type="button" title="Bold" onClick={handleBold} className={`p-1.5 rounded transition-colors ${fontWeight === "bold" ? "bg-violet-600 text-white" : "hover:bg-gray-600"}`} aria-label="Bold">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button type="button" title="Italic" onClick={handleItalic} className={`p-1.5 rounded transition-colors ${fontStyle === "italic" ? "bg-violet-600 text-white" : "hover:bg-gray-600"}`} aria-label="Italic">
              <Italic className="w-3.5 h-3.5" />
            </button>
            {/* Font size */}
            <Popover.Root open={fontSizeOpen} onOpenChange={setFontSizeOpen}>
              <Popover.Trigger asChild>
                <button type="button" title="Font size" className="p-1.5 rounded hover:bg-gray-600 transition-colors flex items-center gap-0.5" aria-label="Font size">
                  <Type className="w-3.5 h-3.5" />
                  <span className="text-[10px] opacity-80">{FONT_SIZES.find((f) => f.value === fontSize)?.label ?? "S"}</span>
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="z-50 w-28 p-2 rounded-lg bg-gray-800 border border-gray-600 shadow-lg" sideOffset={4} align="start">
                  <div className="text-xs text-gray-400 mb-2">Font size</div>
                  <div className="flex flex-col gap-0.5">
                    {FONT_SIZES.map((f) => (
                      <button key={f.value} type="button" onClick={() => handleFontSize(f.value)} className={`px-2 py-1.5 text-left text-sm rounded hover:bg-gray-700 ${fontSize === f.value ? "bg-gray-700" : ""}`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
            <div className="w-px h-4 bg-gray-600 mx-0.5" />
            {/* Edit label */}
            <button type="button" title="Edit label" onClick={() => setIsEditing(true)} className="p-1.5 rounded hover:bg-gray-600 transition-colors" aria-label="Edit label">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {/* Add description */}
            <button type="button" title={description ? "Edit description" : "Add description"} onClick={() => setIsEditingDesc(true)} className={`p-1.5 rounded transition-colors ${description ? "bg-violet-600 text-white" : "hover:bg-gray-600"}`} aria-label="Description">
              <FileText className="w-3.5 h-3.5" />
            </button>
            {/* Annotation label */}
            <button
              type="button"
              title={annotation ? "Edit annotation" : "Add annotation"}
              onClick={() => {
                if (!annotation) { pushUndo(); updateNodeData(id, { annotation: "Label" }); }
              }}
              className={`p-1.5 rounded transition-colors ${annotation ? "bg-violet-600 text-white" : "hover:bg-gray-600"}`}
              aria-label="Annotation"
            >
              <Tag className="w-3.5 h-3.5" />
            </button>
            {/* Notes */}
            <button type="button" title="Notes (Shift+E)" onClick={handleOpenDetails} className="p-1.5 rounded hover:bg-gray-600 transition-colors" aria-label="Notes">
              <FileText className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-gray-600 mx-0.5" />
            {/* Duplicate */}
            <button type="button" title="Duplicate" onClick={handleDuplicate} className="p-1.5 rounded hover:bg-gray-600 transition-colors" aria-label="Duplicate">
              <Copy className="w-3.5 h-3.5" />
            </button>
            {/* Ungroup */}
            <button type="button" title="Ungroup (⌘⇧G)" onClick={handleUngroup} className="p-1.5 rounded hover:bg-gray-600 transition-colors" aria-label="Ungroup">
              <Ungroup className="w-3.5 h-3.5" />
            </button>
            {/* Delete */}
            <button type="button" title="Delete" onClick={handleDelete} className="p-1.5 rounded hover:bg-gray-600 transition-colors" aria-label="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </NodeToolbar>
      )}

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
          "rounded-xl border-2 overflow-visible transition-colors box-border flex flex-col",
          color.bg,
          selected ? "border-violet-400 ring-2 ring-violet-200" : color.border,
          isHovered && !selected && "border-violet-300 bg-violet-50/80 ring-2 ring-violet-200/60"
        )}
        style={{
          minWidth: MIN_GROUP_WIDTH,
          minHeight: MIN_GROUP_HEIGHT,
          ...(nodeWidth != null && { width: nodeWidth }),
          ...(nodeHeight != null && { height: nodeHeight }),
          ...(nodeWidth == null && { width: "100%" }),
          ...(nodeHeight == null && { height: "100%" }),
        }}
        onMouseEnter={() => setHoveredNodeId(id)}
        onMouseLeave={() => setHoveredNodeId(null)}
      >
        {/* ── Header (fixed height so children area is predictable) ── */}
        <div className={cn("shrink-0 px-3 py-2 border-b border-slate-300/50 flex items-center gap-2 min-h-[36px]", color.header)}>
          {/* Icon / emoji */}
          {renderIcon()}
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
              className={cn(
                "flex-1 font-semibold truncate",
                fontSizeCls,
                color.text,
                fontWeight === "bold" && "font-bold",
                fontStyle === "italic" && "italic"
              )}
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
        {/* ── Description (optional subtitle) ── */}
        {(description || isEditingDesc) && (
          <div className={cn("shrink-0 px-3 py-1 border-b border-slate-200/50", color.bg)}>
            {isEditingDesc ? (
              <input
                autoFocus
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                onBlur={handleDescSave}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDescSave();
                  if (e.key === "Escape") { setIsEditingDesc(false); setDescValue(description); }
                }}
                className="w-full text-[11px] bg-white/70 border border-violet-200 rounded px-1.5 py-0.5 outline-none ring-1 ring-violet-100 nodrag text-gray-500"
                placeholder="Description..."
              />
            ) : (
              <p
                className="text-[11px] text-gray-500 truncate cursor-text"
                onDoubleClick={(e) => { e.stopPropagation(); setIsEditingDesc(true); }}
                title={description}
              >
                {description}
              </p>
            )}
          </div>
        )}
        {/* Content area: fills remaining height so group box matches style.height exactly */}
        <div className="flex-1 min-h-0 w-full" aria-hidden />
      </div>

      {/* ── Floating annotation label below group ── */}
      {annotation && (
        <div className="absolute left-1/2 -translate-x-1/2 mt-1 nodrag nopan" style={{ top: "100%" }}>
          <div
            className={cn(
              "px-2 py-0.5 text-[11px] text-center text-gray-600 bg-white/90 border border-gray-200 rounded shadow-sm whitespace-nowrap max-w-[200px] truncate",
              selected && "cursor-text hover:border-violet-300"
            )}
            title={annotation}
          >
            {annotation}
          </div>
        </div>
      )}
    </>
  );
}

export default memo(GroupNode);
