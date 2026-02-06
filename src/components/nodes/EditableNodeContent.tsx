"use client";

import { useCallback, useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";

export type FontSize = "xs" | "sm" | "base" | "lg" | "xl";

export interface NodeFormatting {
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "line-through";
  fontSize?: FontSize;
}

interface EditableNodeContentProps {
  nodeId: string;
  value: string;
  placeholder?: string;
  className?: string;
  onEditingChange?: (editing: boolean) => void;
  editRef?: React.RefObject<HTMLDivElement | null>;
  formatting?: NodeFormatting;
  /** When set, called with final value on blur instead of updating node label (for use in custom nodes e.g. table cells). */
  onCommit?: (value: string) => void;
  /** When true, text is only editable after "Edit text" in the node toolbar; click on text does not focus. */
  editOnlyViaToolbar?: boolean;
}

/**
 * Editable text content for nodes. Click to edit; nodrag/nokey prevent
 * accidental node dragging when interacting with text.
 */
const FONT_SIZE_CLASSES: Record<FontSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  base: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

export function EditableNodeContent({
  nodeId,
  value,
  placeholder = "Type here...",
  className,
  onEditingChange,
  editRef,
  formatting,
  onCommit,
  editOnlyViaToolbar = false,
}: EditableNodeContentProps) {
  const { updateNodeData } = useReactFlow();
  const editingNodeId = useCanvasStore((s) => s.editingNodeId);
  const setEditingNodeId = useCanvasStore((s) => s.setEditingNodeId);
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = editRef ?? internalRef;

  const isEditing = !editOnlyViaToolbar || editingNodeId === nodeId;

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value && !ref.current.matches(":focus")) {
      ref.current.innerText = value || "";
    }
  }, [value, isEditing]);

  useEffect(() => {
    if (ref.current && !ref.current.innerText) {
      ref.current.innerText = value || "";
    }
  }, []);

  useEffect(() => {
    if (editOnlyViaToolbar && editingNodeId === nodeId && ref.current) {
      ref.current.innerText = value || "";
      ref.current.focus();
    }
  }, [editOnlyViaToolbar, editingNodeId, nodeId, value]);

  const handleBlur = useCallback(() => {
    onEditingChange?.(false);
    if (editOnlyViaToolbar) setEditingNodeId(null);
    const text = ref.current?.innerText?.trim() ?? "";
    const final = text || placeholder;
    if (final !== value) {
      if (onCommit) onCommit(final);
      else updateNodeData(nodeId, { label: final });
    }
  }, [nodeId, value, placeholder, updateNodeData, onEditingChange, onCommit, editOnlyViaToolbar, setEditingNodeId]);

  const handleFocus = useCallback(() => {
    pushUndo();
    onEditingChange?.(true);
  }, [onEditingChange, pushUndo]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        ref.current?.blur();
      }
      if (e.key === "Escape") {
        ref.current!.innerText = value;
        ref.current?.blur();
      }
    },
    [value]
  );

  const formatStyle: React.CSSProperties = {};
  if (formatting?.fontWeight) formatStyle.fontWeight = formatting.fontWeight;
  if (formatting?.fontStyle) formatStyle.fontStyle = formatting.fontStyle;
  if (formatting?.textDecoration) formatStyle.textDecoration = formatting.textDecoration;

  const fontSizeClass = formatting?.fontSize ? FONT_SIZE_CLASSES[formatting.fontSize] : undefined;

  const handleDoubleClickToEdit = useCallback(() => {
    if (editOnlyViaToolbar) {
      setEditingNodeId(nodeId);
    }
  }, [editOnlyViaToolbar, nodeId, setEditingNodeId]);

  if (editOnlyViaToolbar && !isEditing) {
    return (
      <div
        className={cn(
          "nodrag nokey min-w-[1ch] truncate cursor-text",
          !value && "text-gray-400",
          className,
          fontSizeClass
        )}
        style={Object.keys(formatStyle).length > 0 ? formatStyle : undefined}
        onDoubleClick={handleDoubleClickToEdit}
        title="Double-click to edit"
      >
        {value || placeholder}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={cn(
        "nodrag nokey outline-none min-w-[1ch] cursor-text",
        "empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400",
        className,
        fontSizeClass
      )}
      style={Object.keys(formatStyle).length > 0 ? formatStyle : undefined}
      data-placeholder={placeholder}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
    />
  );
}
