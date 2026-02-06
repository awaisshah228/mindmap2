"use client";

import { memo, useCallback } from "react";
import { Handle, useReactFlow, Position, type NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { BaseNode } from "./BaseNode";
import { EditableTableCell } from "./EditableTableCell";
import { PALETTE_COLORS } from "@/lib/branch-colors";

const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 3;
const MIN_ROWS = 1;
const MIN_COLS = 1;
const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 160;

function TableNodeComponent({ id, data, selected }: NodeProps) {
  const { updateNodeData } = useReactFlow();
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const rows = Math.max(MIN_ROWS, (data.tableRows as number) ?? DEFAULT_ROWS);
  const cols = Math.max(MIN_COLS, (data.tableCols as number) ?? DEFAULT_COLS);
  const cells = (data.cells as Record<string, string>) ?? {};
  const bgColor = (data.color as string) ?? PALETTE_COLORS[0];

  const addRow = useCallback(() => {
    pushUndo();
    updateNodeData(id, { tableRows: rows + 1 });
  }, [id, rows, updateNodeData, pushUndo]);

  const addColumn = useCallback(() => {
    pushUndo();
    updateNodeData(id, { tableCols: cols + 1 });
  }, [id, cols, updateNodeData, pushUndo]);

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className={cn(
        "relative border-2 rounded overflow-visible",
        selected ? "border-violet-400 shadow-md" : "border-gray-300"
      )}
      style={{ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, backgroundColor: bgColor }}
      minWidth={120}
      minHeight={80}
    >
      <div className="w-full h-full flex flex-col">
        <div className="flex flex-1 min-h-0">
          <div
            className="grid flex-1 min-w-0 min-h-0"
            style={{
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
            }}
          >
            {Array.from({ length: rows * cols }).map((_, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const cellKey = `${r},${c}`;
              const value = cells[cellKey] ?? "";
              return (
                <div
                  key={cellKey}
                  className="border border-gray-300/90 min-w-0 min-h-0 flex items-stretch p-0.5 bg-white/90"
                >
                  <EditableTableCell
                    nodeId={id}
                    cellKey={cellKey}
                    value={value}
                    placeholder=""
                    className="text-xs w-full overflow-hidden break-words"
                  />
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={addColumn}
            className="nodrag nokey flex-shrink-0 w-7 flex items-center justify-center text-violet-600 hover:bg-violet-100 rounded-r transition-colors self-center"
            title="Add column"
            aria-label="Add column"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="nodrag nokey flex-shrink-0 h-7 flex items-center justify-center text-violet-600 hover:bg-violet-100 rounded-b transition-colors"
          title="Add row"
          aria-label="Add row"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <Handle id="top" type="target" position={Position.Top} className={cn("!w-5 !h-5 !-top-2.5 !left-1/2 !-translate-x-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/90 hover:!bg-violet-50" : "!opacity-0")} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={cn("!w-5 !h-5 !-bottom-2.5 !left-1/2 !-translate-x-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/90 hover:!bg-violet-50" : "!opacity-0")} />
      <Handle id="left" type="target" position={Position.Left} className={cn("!w-5 !h-5 !-left-2.5 !top-1/2 !-translate-y-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/90 hover:!bg-violet-50" : "!opacity-0")} />
      <Handle id="right" type="source" position={Position.Right} className={cn("!w-5 !h-5 !-right-2.5 !top-1/2 !-translate-y-1/2 !rounded !border-2 !transition-all", selected ? "!border-violet-400/50 !bg-white/90 hover:!bg-violet-50" : "!opacity-0")} />
    </BaseNode>
  );
}

export default memo(TableNodeComponent);
