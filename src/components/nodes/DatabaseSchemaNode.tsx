"use client";

import { memo, useCallback, useMemo } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { Database, Plus, Trash2, Key, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { getIconById } from "@/lib/icon-registry";

export interface SchemaColumn {
  name: string;
  type?: string;
  key?: "PK" | "FK" | "";
}

const DEFAULT_WIDTH = 260;
const DEFAULT_HEIGHT = 220;
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
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const tableName = (data.label as string) || "Table";
  const iconDef = getIconById(data.icon as string);
  const IconComp = iconDef?.Icon;
  const iconUrl = data.iconUrl as string | undefined;
  const columns: SchemaColumn[] = useMemo(
    () =>
      Array.isArray(data.columns)
        ? (data.columns as SchemaColumn[])
        : [
            { name: "id", type: "uuid", key: "PK" },
            { name: "created_at", type: "timestamp", key: "" },
          ],
    [data.columns]
  );

  const updateColumns = useCallback(
    (next: SchemaColumn[]) => {
      pushUndo();
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, columns: next } } : n
        )
      );
    },
    [id, setNodes, pushUndo]
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
      className={cn(
        "overflow-visible rounded-lg border shadow-md",
        selected ? "border-violet-400 ring-2 ring-violet-200" : "border-slate-300"
      )}
      style={{ width: DEFAULT_WIDTH, minHeight: DEFAULT_HEIGHT, backgroundColor: "#fff" }}
      minWidth={200}
      minHeight={120}
    >
      {/* Edge handles */}
      <Handle type="source" position={Position.Left} id="left" className="node-connect-handle" />
      <Handle type="source" position={Position.Right} id="right" className="node-connect-handle" />
      <Handle type="source" position={Position.Top} id="top" className="node-connect-handle" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="node-connect-handle" />

      <div className="flex flex-col h-full overflow-hidden rounded-lg">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800 shrink-0">
          {IconComp ? (
            <IconComp className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : iconUrl ? (
            <img src={iconUrl} alt="" className="w-4 h-4 object-contain shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <Database className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <div className="nodrag nokey min-w-0 flex-1">
            <EditableNodeContent
              nodeId={id}
              value={tableName}
              placeholder="Table name"
              className="text-sm font-bold text-white tracking-wide"
              editOnlyViaToolbar
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono shrink-0">{columns.length} cols</span>
        </div>

        {/* Column header */}
        <div className="grid grid-cols-[24px_40px_1fr_1fr_24px_28px] items-center gap-0 px-0 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          <span />
          <span className="px-1">Key</span>
          <span className="px-2">Column</span>
          <span className="px-2">Type</span>
          <span />
          <span />
        </div>

        {/* Columns */}
        <div className="flex-1 min-h-0 overflow-auto">
          {columns.map((col, i) => {
            const { target: targetId, source: sourceId } = getHandleIds(i, col);
            return (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-[24px_40px_1fr_1fr_24px_28px] items-center gap-0 border-b border-slate-100 text-xs group/row transition-colors hover:bg-blue-50/50",
                  i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                )}
              >
                {/* Left handle */}
                <div className="flex items-center justify-center">
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={targetId}
                    className="!w-2 !h-2 !-left-1 !relative !translate-y-0 !top-0 !bg-blue-400 !border !border-blue-300"
                    title={`Connect to ${col.name}`}
                  />
                </div>

                {/* Key badge */}
                <div className="px-0.5 py-1.5">
                  <button
                    type="button"
                    className={cn(
                      "nodrag nokey w-full flex items-center justify-center gap-0.5 py-0.5 rounded text-[10px] font-bold transition-colors",
                      col.key === "PK"
                        ? "bg-amber-100 text-amber-700"
                        : col.key === "FK"
                          ? "bg-blue-100 text-blue-700"
                          : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                    )}
                    title="Click to cycle PK / FK / none"
                    onClick={() => cycleKey(i)}
                  >
                    {col.key === "PK" ? <Key className="w-3 h-3" /> : col.key === "FK" ? <Link className="w-3 h-3" /> : "—"}
                  </button>
                </div>

                {/* Column name */}
                <div className="px-2 py-1.5 min-w-0">
                  <div className="nodrag nokey min-h-[20px]" key={`col-${i}-name`}>
                    <EditableNodeContent
                      nodeId={id}
                      value={col.name}
                      placeholder="column"
                      className="font-mono font-medium text-slate-800 w-full min-w-[40px]"
                      onCommit={(value) => updateColumn(i, { name: value })}
                    />
                  </div>
                </div>

                {/* Column type */}
                <div className="px-2 py-1.5 min-w-0">
                  <div className="nodrag nokey min-h-[20px] flex items-center gap-1" key={`col-${i}-type`}>
                    <select
                      className="nodrag nokey text-[11px] text-slate-500 bg-white border border-slate-200 rounded px-1 py-0.5 h-6 min-w-0 max-w-[90px] font-mono"
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
                      <option value={CUSTOM_TYPE}>custom...</option>
                    </select>
                    {showCustomType(col) && (
                      <EditableNodeContent
                        nodeId={id}
                        value={isCommonType(col.type ?? "") ? "" : (col.type ?? "")}
                        placeholder="type"
                        className="text-slate-500 flex-1 min-w-[30px] text-[11px] font-mono"
                        onCommit={(value) => updateColumn(i, { type: value })}
                      />
                    )}
                  </div>
                </div>

                {/* Right handle */}
                <div className="flex items-center justify-center">
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={sourceId}
                    className="!w-2 !h-2 !-right-1 !relative !translate-y-0 !top-0 !left-auto !bg-blue-400 !border !border-blue-300"
                    title={`Connect from ${col.name}`}
                  />
                </div>

                {/* Delete button */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    className="nodrag nokey p-0.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/row:opacity-100 transition-all"
                    title="Delete row"
                    onClick={() => removeColumn(i)}
                    disabled={columns.length <= 1}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add column footer */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50/80">
          <button
            type="button"
            className="nodrag nokey w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-colors font-medium"
            onClick={addColumn}
            title="Add a new column"
          >
            <Plus className="w-3.5 h-3.5" />
            Add column
          </button>
        </div>
      </div>
    </BaseNode>
  );
}

export default memo(DatabaseSchemaNode);
