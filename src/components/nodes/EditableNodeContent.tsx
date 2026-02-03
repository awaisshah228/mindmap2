"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";

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
}: EditableNodeContentProps) {
  const { updateNodeData } = useReactFlow();
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = editRef ?? internalRef;

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value && !ref.current.matches(":focus")) {
      ref.current.innerText = value || "";
    }
  }, [value]);

  useEffect(() => {
    if (ref.current && !ref.current.innerText) {
      ref.current.innerText = value || "";
    }
  }, []);

  const handleBlur = useCallback(() => {
    onEditingChange?.(false);
    const text = ref.current?.innerText?.trim() ?? "";
    const final = text || placeholder;
    if (final !== value) {
      updateNodeData(nodeId, { label: final });
    }
  }, [nodeId, value, placeholder, updateNodeData, onEditingChange]);

  const handleFocus = useCallback(() => {
    onEditingChange?.(true);
  }, [onEditingChange]);

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
