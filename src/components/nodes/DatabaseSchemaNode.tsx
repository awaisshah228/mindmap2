"use client";

import { memo, useCallback } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { Database, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";

export interface SchemaColumn {
  name: string;
  type?: string;
  key?: "PK" | "FK" | "";
}

const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 200;
const KEY_OPTIONS: ("PK" | "FK" | "")[] = ["", "PK", "FK"];

const COMMON_TYPES = [
  "varchar",
  "text",
  "uuid",
  "int4",
  "int8",
  "serial",
  "float8",
  "boolean",
  "timestamp",
  "timestamptz",
  "date",
  "money",
  "jsonb",
] as const;
const CUSTOM_TYPE = "__custom__";

function DatabaseSchemaNode({ id, data, selected }: NodeProps) {
  const setNodes = useCanvasStore((s) => s.setNodes);
  const tableName = (data.label as string) || "Table";
  const columns: SchemaColumn[] = Array.isArray(data.columns)
    ? (data.columns as SchemaColumn[])
    : [
        { name: "id", type: "uuid", key: "PK" },
        { name: "created_at", type: "timestamp", key: "" },
      ];

  const updateColumns = useCallback(
    (next: SchemaColumn[]) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, columns: next } } : n
        )
      );
    },
    [id, setNodes]
  );

  const updateColumn = useCallback(
    (index: number, patch: Partial<SchemaColumn>) => {
      const next = columns.map((col, i) =>
        i === index ? { ...col, ...patch } : col
      );
      updateColumns(next);
    },
    [columns, updateColumns]
  );

  const addColumn = useCallback(() => {
    updateColumns([
      ...columns,
      { name: "new_column", type: "text", key: "" },
    ]);
  }, [columns, updateColumns]);

  const removeColumn = useCallback(
    (index: number) => {
      if (columns.length <= 1) return;
      updateColumns(columns.filter((_, i) => i !== index));
    },
    [columns, updateColumns]
  );

  const cycleKey = useCallback(
    (index: number) => {
      const col = columns[index];
      const current = col?.key ?? "";
      const idx = KEY_OPTIONS.indexOf(current);
      const next = KEY_OPTIONS[(idx + 1) % KEY_OPTIONS.length];
      updateColumn(index, { key: next });
    },
    [columns, updateColumn]
  );

  /** Stable handle ids per row for edge connections (FK → PK between tables). */
  const getHandleIds = useCallback((index: number, col: SchemaColumn) => {
    const base = (col.name || `col-${index}`).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || `col-${index}`;
    return { target: base, source: `${base}-out` };
  }, []);

  const isCommonType = (t: string) => COMMON_TYPES.includes(t as (typeof COMMON_TYPES)[number]);
  const showCustomType = (col: SchemaColumn) => !col.type || !isCommonType(col.type);

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className="overflow-visible rounded-lg border-2 border-amber-700/40 bg-amber-50/95"
      style={{ width: DEFAULT_WIDTH, minHeight: DEFAULT_HEIGHT }}
      minWidth={160}
      minHeight={100}
    >
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !-left-1 !top-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !-right-1 !top-1/2 !-translate-y-1/2" />
      <Handle type="target" position={Position.Top} id="top" className="!w-2 !h-2 !-top-1 !left-1/2 !-translate-x-1/2" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!w-2 !h-2 !-bottom-1 !left-1/2 !-translate-x-1/2" />

      <div className="flex flex-col h-full overflow-hidden rounded-b-lg">
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-700/20 border-b border-amber-700/30 shrink-0">
          <Database className="w-4 h-4 text-amber-800 shrink-0" />
          <div className="nodrag nokey min-w-0 flex-1">
            <EditableNodeContent
              nodeId={id}
              value={tableName}
              placeholder="Table name"
              className="text-sm font-semibold text-amber-900 truncate"
              editOnlyViaToolbar
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-amber-800/80 border-b border-amber-200">
                <th className="px-0 py-1 font-medium w-6" title="Connect to this column" />
                <th className="px-1 py-1 font-medium w-14">Key</th>
                <th className="px-2 py-1 font-medium">Column</th>
                <th className="px-2 py-1 font-medium">Type</th>
                <th className="px-0 py-1 w-6" title="Connect from this column" />
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {columns.map((col, i) => {
                const { target: targetId, source: sourceId } = getHandleIds(i, col);
                return (
                  <tr
                    key={i}
                    className={cn(
                      "border-b border-amber-100 text-xs group/row",
                      i % 2 === 0 ? "bg-white/50" : "bg-amber-50/50"
                    )}
                  >
                    <td className="px-0 py-0.5 align-middle w-6">
                      <Handle
                        type="target"
                        position={Position.Left}
                        id={targetId}
                        className="!w-2 !h-2 !-left-1 !relative !translate-y-0 !top-0"
                        title={`Connect to ${col.name}`}
                      />
                    </td>
                    <td className="px-1 py-0.5 align-middle">
                      <button
                        type="button"
                        className="nodrag nokey w-full text-left px-1.5 py-0.5 rounded font-mono text-[10px] text-amber-700 hover:bg-amber-200/50 min-h-[20px]"
                        title="Click to cycle PK / FK / none"
                        onClick={() => cycleKey(i)}
                      >
                        {col.key || "—"}
                      </button>
                    </td>
                    <td className="px-2 py-0.5 align-middle">
                      <div className="nodrag nokey min-h-[20px]" key={`col-${i}-name`}>
                        <EditableNodeContent
                          nodeId={id}
                          value={col.name}
                          placeholder="column"
                          className="font-medium text-gray-800 w-full min-w-[60px]"
                          onCommit={(value) => updateColumn(i, { name: value })}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-0.5 align-middle">
                      <div className="nodrag nokey min-h-[20px] flex items-center gap-1" key={`col-${i}-type`}>
                        <select
                          className="nodrag nokey text-[11px] text-gray-600 bg-white/80 border border-amber-200/80 rounded px-1.5 py-0.5 h-6 min-w-0 max-w-[100px]"
                          value={isCommonType(col.type ?? "") ? col.type : CUSTOM_TYPE}
                          onChange={(e) => {
                            const v = e.target.value;
                            updateColumn(i, { type: v === CUSTOM_TYPE ? "" : v });
                          }}
                          title="Column type"
                        >
                          {COMMON_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                          <option value={CUSTOM_TYPE}>Other</option>
                        </select>
                        {showCustomType(col) && (
                          <EditableNodeContent
                            nodeId={id}
                            value={isCommonType(col.type ?? "") ? "" : (col.type ?? "")}
                            placeholder="e.g. varchar(255)"
                            className="text-gray-600 flex-1 min-w-[40px] text-[11px]"
                            onCommit={(value) => updateColumn(i, { type: value })}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-0 py-0.5 align-middle w-6 text-right">
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={sourceId}
                        className="!w-2 !h-2 !-right-1 !relative !translate-y-0 !top-0 !left-auto"
                        title={`Connect from ${col.name}`}
                      />
                    </td>
                    <td className="px-0 py-0.5 align-middle text-right">
                      <button
                        type="button"
                        className="nodrag nokey p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover/row:opacity-100 transition-opacity"
                        title="Delete row"
                        onClick={() => removeColumn(i)}
                        disabled={columns.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="shrink-0 border-t border-amber-200 px-2 py-1.5">
          <button
            type="button"
            className="nodrag nokey w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-amber-700 hover:bg-amber-200/50 rounded"
            onClick={addColumn}
            title="Add a new column row"
          >
            <Plus className="w-3.5 h-3.5" />
            Add row
          </button>
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(DatabaseSchemaNode);
