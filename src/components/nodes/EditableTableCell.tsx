"use client";

import { useCallback, useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";

interface EditableTableCellProps {
  nodeId: string;
  cellKey: string;
  value: string;
  placeholder?: string;
  className?: string;
}

/**
 * Editable cell content for table nodes. Updates node.data.cells[cellKey] on blur.
 */
export function EditableTableCell({
  nodeId,
  cellKey,
  value,
  placeholder = "",
  className,
}: EditableTableCellProps) {
  const { getNode, updateNodeData } = useReactFlow();
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const ref = useRef<HTMLDivElement>(null);
  const undoPushedRef = useRef(false);

  useEffect(() => {
    if (ref.current && ref.current.innerText !== value && !ref.current.matches(":focus")) {
      ref.current.innerText = value || "";
    }
  }, [value]);

  const handleFocus = useCallback(() => {
    if (!undoPushedRef.current) {
      pushUndo();
      undoPushedRef.current = true;
    }
  }, [pushUndo]);

  const handleBlur = useCallback(() => {
    undoPushedRef.current = false;
    const text = ref.current?.innerText?.trim() ?? "";
    const node = getNode(nodeId);
    const cells = (node?.data?.cells as Record<string, string>) ?? {};
    if (text !== (cells[cellKey] ?? "")) {
      updateNodeData(nodeId, { cells: { ...cells, [cellKey]: text } });
    }
  }, [nodeId, cellKey, getNode, updateNodeData]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        ref.current!.innerText = value || "";
        ref.current?.blur();
      }
    },
    [value]
  );

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={cn(
        "nodrag nokey outline-none min-w-[1ch] cursor-text w-full min-h-[1.5em]",
        "empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400",
        className
      )}
      data-placeholder={placeholder}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
