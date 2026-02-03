"use client";

import { memo, useCallback, useState, useMemo } from "react";
import {
  EdgeToolbar,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  useReactFlow,
  Position,
  MarkerType,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { getBranchStrokeColor } from "@/lib/branch-colors";
import { BaseEdge } from "./BaseEdge";

const EDGE_STROKE_WIDTH = 3;
/** Offset toolbar above the label so it doesn't cover placeholder/input */
const TOOLBAR_OFFSET_Y = -48;

/** Node types that allow edge labels (labels only between shape nodes). */
const SHAPE_NODE_TYPES = ["rectangle", "diamond", "circle", "document"];

type ConnectorType = "smoothstep" | "default" | "straight" | "step";

interface PathPoint {
  x: number;
  y: number;
}

const pathParams = (sp: Position, tp: Position) => ({
  sourcePosition: sp,
  targetPosition: tp,
});


function buildCustomPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  pathPoints: PathPoint[]
): string {
  const pts = [
    { x: sourceX, y: sourceY },
    ...pathPoints,
    { x: targetX, y: targetY },
  ];
  return pts
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
}

function LabeledConnectorEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Right,
  targetPosition = Position.Left,
  data,
  selected,
  markerEnd,
  markerStart,
}: import("@xyflow/react").EdgeProps) {
  const { updateEdgeData, deleteElements, screenToFlowPosition, getEdges, getNodes, setEdges } = useReactFlow();
  const nodes = getNodes();
  const edges = getEdges();
  const allowLabels = useMemo(() => {
    const sourceNode = nodes.find((n) => n.id === source);
    const targetNode = nodes.find((n) => n.id === target);
    return (
      sourceNode &&
      targetNode &&
      SHAPE_NODE_TYPES.includes(sourceNode.type ?? "") &&
      SHAPE_NODE_TYPES.includes(targetNode.type ?? "")
    );
  }, [nodes, source, target]);
  const branchColor = useMemo(
    () => (data?.strokeColor as string | undefined) ?? getBranchStrokeColor(source, target, edges),
    [source, target, edges, data?.strokeColor]
  );
  const connectorType = (data?.connectorType as ConnectorType) ?? "default";
  const label = (data?.label as string) ?? "";
  const pathPoints = (data?.pathPoints as PathPoint[] | undefined) ?? [];
  const strokeDasharray = (data?.strokeDasharray as string | undefined) ?? undefined;
  const effectivePathPoints = pathPoints;
  const hasCustomPath = effectivePathPoints.length > 0;

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const params = {
    sourceX,
    sourceY,
    targetX,
    targetY,
    ...pathParams(sourcePosition, targetPosition),
  };

  const defaultPathResult = hasCustomPath
    ? null
    : connectorType === "straight"
      ? getStraightPath({ sourceX, sourceY, targetX, targetY })
      : connectorType === "default"
        ? getBezierPath(params)
        : getSmoothStepPath({
            ...params,
            borderRadius: connectorType === "step" ? 0 : 5,
          });

  const edgePath = hasCustomPath
    ? buildCustomPath(sourceX, sourceY, targetX, targetY, effectivePathPoints)
    : defaultPathResult?.[0] ?? "";
  const labelX = defaultPathResult?.[1] ?? (sourceX + targetX) / 2;
  const labelY = defaultPathResult?.[2] ?? (sourceY + targetY) / 2;

  const setConnectorType = useCallback(
    (type: ConnectorType) => {
      updateEdgeData(id, { connectorType: type, pathPoints: [] });
    },
    [id, updateEdgeData]
  );

  const handleLabelSave = useCallback(() => {
    setIsEditingLabel(false);
    updateEdgeData(id, { label: editValue });
  }, [id, editValue, updateEdgeData]);

  const handleDelete = useCallback(() => {
    deleteElements({ edges: [{ id }] });
  }, [id, deleteElements]);

  const handleAddPoint = useCallback(() => {
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;
    const newPoints = [...effectivePathPoints, { x: midX, y: midY }];
    updateEdgeData(id, { pathPoints: newPoints });
  }, [id, effectivePathPoints, sourceX, sourceY, targetX, targetY, updateEdgeData]);

  const handleResetPath = useCallback(() => {
    updateEdgeData(id, { pathPoints: [] });
  }, [id, updateEdgeData]);

  const handlePointDrag = useCallback(
    (index: number, clientX: number, clientY: number) => {
      const pos = screenToFlowPosition({ x: clientX, y: clientY });
      const newPoints = [...effectivePathPoints];
      newPoints[index] = { x: pos.x, y: pos.y };
      updateEdgeData(id, { pathPoints: newPoints });
    },
    [id, effectivePathPoints, screenToFlowPosition, updateEdgeData]
  );

  const onPointMouseDown = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingIndex(index);
      const onMouseMove = (moveEvent: MouseEvent) => {
        handlePointDrag(index, moveEvent.clientX, moveEvent.clientY);
      };
      const onMouseUp = () => {
        setDraggingIndex(null);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [handlePointDrag]
  );

  const setMarkerEnd = useCallback(
    (value: string | undefined) => {
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, markerEnd: value } : e)));
    },
    [id, setEdges]
  );
  const setMarkerStart = useCallback(
    (value: string | undefined) => {
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, markerStart: value } : e)));
    },
    [id, setEdges]
  );
  const setLineStyle = useCallback(
    (dashed: boolean) => {
      updateEdgeData(id, { strokeDasharray: dashed ? "5 5" : undefined });
    },
    [id, updateEdgeData]
  );

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        selected={selected}
        strokeColor={branchColor}
        strokeWidth={EDGE_STROKE_WIDTH}
        markerEnd={markerEnd}
        markerStart={markerStart}
        strokeDasharray={strokeDasharray}
      />
      <EdgeToolbar edgeId={id} x={labelX} y={labelY + TOOLBAR_OFFSET_Y} isVisible={selected}>
        <div className="flex flex-wrap items-center gap-1 bg-gray-800 text-gray-200 rounded-lg px-2 py-1.5 shadow-lg border border-gray-700">
          <button
            type="button"
            onClick={() => setConnectorType("smoothstep")}
            title="Curved"
            className={cn(
              "p-1.5 rounded hover:bg-gray-600",
              connectorType === "smoothstep" && !hasCustomPath && "bg-violet-600"
            )}
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path
                d="M1 6 Q4 2 8 6 T15 6"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setConnectorType("default")}
            title="Bezier"
            className={cn(
              "p-1.5 rounded hover:bg-gray-600",
              connectorType === "default" && !hasCustomPath && "bg-violet-600"
            )}
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path
                d="M1 1 Q8 11 15 11"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setConnectorType("straight")}
            title="Straight"
            className={cn(
              "p-1.5 rounded hover:bg-gray-600",
              connectorType === "straight" && !hasCustomPath && "bg-violet-600"
            )}
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M1 6 L15 6" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setConnectorType("step")}
            title="Step"
            className={cn(
              "p-1.5 rounded hover:bg-gray-600",
              connectorType === "step" && !hasCustomPath && "bg-violet-600"
            )}
          >
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path
                d="M1 6 H8 V1 H15"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
          </button>
          <div className="w-px h-4 bg-gray-600 mx-0.5" />
          <button
            type="button"
            onClick={handleAddPoint}
            title="Add control point"
            className="px-2 py-1 rounded hover:bg-gray-600 text-xs"
          >
            + Point
          </button>
          {hasCustomPath && (
            <button
              type="button"
              onClick={handleResetPath}
              title="Reset to default path"
              className="px-2 py-1 rounded hover:bg-gray-600 text-xs"
            >
              Reset path
            </button>
          )}
          <div className="w-px h-4 bg-gray-600 mx-0.5" />
          <button
            type="button"
            onClick={() => setLineStyle(true)}
            title="Dashed line"
            className={cn("px-2 py-1 rounded hover:bg-gray-600 text-xs", strokeDasharray && "bg-violet-600")}
          >
            Dashed
          </button>
          <button
            type="button"
            onClick={() => setLineStyle(false)}
            title="Solid line"
            className={cn("px-2 py-1 rounded hover:bg-gray-600 text-xs", !strokeDasharray && "bg-violet-600")}
          >
            Solid
          </button>
          <div className="w-px h-4 bg-gray-600 mx-0.5" />
          <button
            type="button"
            onClick={() => setMarkerStart(markerStart ? undefined : MarkerType.ArrowClosed)}
            title="Arrow at start"
            className={cn("p-1.5 rounded hover:bg-gray-600", markerStart && "bg-violet-600")}
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M4 5 L0 0 L0 10 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M4 5 L14 5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setMarkerEnd(markerEnd ? undefined : MarkerType.ArrowClosed)}
            title="Arrow at end"
            className={cn("p-1.5 rounded hover:bg-gray-600", markerEnd && "bg-violet-600")}
          >
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <path d="M0 5 L10 5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 5 L14 0 L14 10 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
          {allowLabels && (
            <>
              <div className="w-px h-4 bg-gray-600 mx-0.5" />
              <button
                type="button"
                onClick={() => {
                  setIsEditingLabel(true);
                  setEditValue(label);
                }}
                className="px-2 py-1 rounded hover:bg-gray-600 text-xs"
              >
                {label ? "Edit label" : "Add label"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleDelete}
            className="p-1 rounded hover:bg-red-600"
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </EdgeToolbar>
      {allowLabels && (
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nokey"
        >
          {isEditingLabel ? (
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLabelSave();
                if (e.key === "Escape") {
                  setEditValue(label);
                  setIsEditingLabel(false);
                }
              }}
              className="px-2 py-1 text-xs bg-white border border-violet-300 rounded shadow focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[60px]"
              autoFocus
            />
          ) : label ? (
            <div
              onClick={() => setIsEditingLabel(true)}
              onDoubleClick={() => setIsEditingLabel(true)}
              className="px-2 py-1 text-xs bg-white border border-gray-200 rounded shadow cursor-text hover:border-violet-300"
            >
              {label}
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => { setEditValue(""); setIsEditingLabel(true); }}
              onDoubleClick={() => { setEditValue(""); setIsEditingLabel(true); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEditValue("");
                  setIsEditingLabel(true);
                }
              }}
              className="px-2 py-1 text-xs text-gray-400 border border-dashed border-gray-300 rounded cursor-text hover:border-violet-300 hover:text-violet-600 min-w-[60px]"
            >
              Double-click to add label
            </div>
          )}
        </div>
        {selected &&
          effectivePathPoints.map((pt, i) => (
            <div
              key={`${id}-point-${i}`}
              role="button"
              tabIndex={0}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(-50%, -50%) translate(${pt.x}px, ${pt.y}px)`,
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: draggingIndex === i ? "rgb(139 92 246)" : "white",
                border: "2px solid rgb(139 92 246)",
                cursor: "grab",
                pointerEvents: "all",
                zIndex: 10,
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
              className="nodrag nokey nopan"
              onMouseDown={(e) => onPointMouseDown(e, i)}
              onKeyDown={(e) => {
                if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  const newPoints = effectivePathPoints.filter((_, idx) => idx !== i);
                  updateEdgeData(id, { pathPoints: newPoints });
                }
              }}
              title="Drag to move • Delete to remove"
            />
          ))}
      </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(LabeledConnectorEdge);
