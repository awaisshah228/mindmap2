"use client";

import { memo, useCallback, useState, useMemo, useRef, useLayoutEffect } from "react";
import {
  EdgeToolbar,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  useReactFlow,
  Position,
  MarkerType,
  type EdgeMarker,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { getBranchStrokeColor } from "@/lib/branch-colors";
import { BaseEdge } from "./BaseEdge";

const EDGE_STROKE_WIDTH = 4;
/** Offset toolbar above the label so it doesn't cover placeholder/input */
const TOOLBAR_OFFSET_Y = -48;
/** Gap length (in path units) where the label sits in the line */
const LABEL_GAP_SIZE = 52;

/** Node types that allow edge labels (shape nodes and edge anchors for standalone lines). */
const SHAPE_NODE_TYPES = ["rectangle", "diamond", "circle", "document"];
const EDGE_ANCHOR_TYPE = "edgeAnchor";

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
    if (!sourceNode || !targetNode) return false;
    const sourceType = sourceNode.type ?? "";
    const targetType = targetNode.type ?? "";
    const bothShapes =
      SHAPE_NODE_TYPES.includes(sourceType) && SHAPE_NODE_TYPES.includes(targetType);
    const bothAnchors = sourceType === EDGE_ANCHOR_TYPE && targetType === EDGE_ANCHOR_TYPE;
    return bothShapes || bothAnchors;
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
  const [hovered, setHovered] = useState(false);
  const [activeMarkerSide, setActiveMarkerSide] = useState<"start" | "end" | null>(null);
  const pathMeasureRef = useRef<SVGPathElement>(null);
  const [gapDasharray, setGapDasharray] = useState<string | null>(null);

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

  const showLabelInLine = allowLabels && (label || isEditingLabel);

  useLayoutEffect(() => {
    if (!showLabelInLine || !pathMeasureRef.current) {
      setGapDasharray(null);
      return;
    }
    const len = pathMeasureRef.current.getTotalLength();
    const half = (len - LABEL_GAP_SIZE) / 2;
    if (half > 0) {
      setGapDasharray(`${half} ${LABEL_GAP_SIZE} ${half}`);
    } else {
      setGapDasharray(null);
    }
  }, [showLabelInLine, edgePath]);

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
    (value: EdgeMarker | undefined) => {
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, markerEnd: value } : e)));
    },
    [id, setEdges]
  );
  const setMarkerStart = useCallback(
    (value: EdgeMarker | undefined) => {
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

  const effectiveStrokeDasharray = showLabelInLine && gapDasharray ? gapDasharray : strokeDasharray;

  type MarkerPreset = {
    id: string;
    title: string;
    /** Factory so marker color can match the current edge color. */
    getMarker: (color: string) => EdgeMarker | undefined;
    icon: JSX.Element;
  };

  const MARKER_PRESETS: MarkerPreset[] = [
    {
      id: "none",
      title: "No marker",
      getMarker: () => undefined,
      icon: (
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <path d="M2 6 L22 6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      id: "arrow-closed",
      title: "Closed arrow",
      getMarker: (color) => ({
        type: MarkerType.ArrowClosed,
        color,
        width: 18,
        height: 18,
      }),
      icon: (
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <path d="M2 6 L19 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M19 3 L22 6 L19 9 Z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "circle",
      title: "Circle",
      getMarker: (color) => ({
        type: MarkerType.Circle,
        color,
        width: 14,
        height: 14,
      }),
      icon: (
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <path d="M2 6 L19 6" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="21" cy="6" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "diamond",
      title: "Diamond",
      getMarker: (color) => ({
        type: MarkerType.Diamond,
        color,
        width: 18,
        height: 18,
      }),
      icon: (
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <path d="M2 6 L18 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 6 L22 4 L24 6 L22 8 Z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "bar",
      title: "Bar",
      getMarker: (color) => ({
        type: MarkerType.Bar,
        color,
        width: 14,
        height: 14,
      }),
      icon: (
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <path d="M2 6 L19 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 2 L20 10" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {showLabelInLine && (
        <svg
          aria-hidden
          style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
        >
          <path ref={pathMeasureRef} d={edgePath} />
        </svg>
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        selected={selected}
        strokeColor={branchColor}
        strokeWidth={EDGE_STROKE_WIDTH}
        markerEnd={markerEnd}
        markerStart={markerStart}
        strokeDasharray={effectiveStrokeDasharray}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeToolbar
        edgeId={id}
        x={labelX}
        y={labelY + TOOLBAR_OFFSET_Y}
        isVisible={selected || hovered || activeMarkerSide !== null}
      >
        <div className="flex flex-wrap items-center gap-2 bg-gray-800 text-gray-200 rounded-lg px-3 py-2 shadow-lg border border-gray-700">
          {/* Edge customization */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mr-0.5">Edge</span>
            <button
              type="button"
              onClick={() => setConnectorType("smoothstep")}
              title="Curved path"
              className={cn(
                "p-1.5 rounded hover:bg-gray-600",
                connectorType === "smoothstep" && !hasCustomPath && "bg-violet-600"
              )}
            >
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M1 6 Q4 2 8 6 T15 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setConnectorType("default")}
              title="Bezier path"
              className={cn(
                "p-1.5 rounded hover:bg-gray-600",
                connectorType === "default" && !hasCustomPath && "bg-violet-600"
              )}
            >
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M1 1 Q8 11 15 11" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setConnectorType("straight")}
              title="Straight path"
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
              title="Step path"
              className={cn(
                "p-1.5 rounded hover:bg-gray-600",
                connectorType === "step" && !hasCustomPath && "bg-violet-600"
              )}
            >
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                <path d="M1 6 H8 V1 H15" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>
            <div className="w-px h-4 bg-gray-600 mx-0.5" />
            <button
              type="button"
              onClick={handleAddPoint}
              title="Add control point to path"
              className="px-2 py-1 rounded hover:bg-gray-600 text-xs whitespace-nowrap"
            >
              + Point
            </button>
            {hasCustomPath && (
              <button
                type="button"
                onClick={handleResetPath}
                title="Reset path to default"
                className="px-2 py-1 rounded hover:bg-gray-600 text-xs"
              >
                Reset
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
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setActiveMarkerSide((side) => (side === "start" ? null : "start"))
                }
                title="Start marker"
                className={cn(
                  "p-1.5 rounded hover:bg-gray-600",
                  markerStart && "bg-violet-600"
                )}
              >
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                  <path d="M4 5 L0 0 L0 10 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M4 5 L14 5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveMarkerSide((side) => (side === "end" ? null : "end"))
                }
                title="End marker"
                className={cn(
                  "p-1.5 rounded hover:bg-gray-600",
                  markerEnd && "bg-violet-600"
                )}
              >
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                  <path d="M0 5 L10 5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 5 L14 0 L14 10 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
              </button>
              {activeMarkerSide && (
                <div className="absolute top-full left-0 mt-1 z-[200] rounded-lg bg-gray-900 text-white shadow-lg border border-gray-700 px-2 py-2 min-w-[140px]">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 px-1 mb-1">
                    {activeMarkerSide === "start" ? "Start marker" : "End marker"}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {MARKER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          const marker = preset.getMarker(branchColor);
                          if (activeMarkerSide === "start") {
                            setMarkerStart(marker);
                          } else {
                            setMarkerEnd(marker);
                          }
                          setActiveMarkerSide(null);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-gray-800"
                        )}
                      >
                        <span className="shrink-0 text-gray-200">{preset.icon}</span>
                        <span className="truncate">{preset.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Label customization */}
          {allowLabels && (
            <>
              <div className="w-px h-4 bg-gray-600" />
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mr-0.5">Label</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingLabel(true);
                    setEditValue(label);
                  }}
                  title="Edit label text"
                  className="px-2 py-1 rounded hover:bg-gray-600 text-xs whitespace-nowrap"
                >
                  {label ? "Edit text" : "Add text"}
                </button>
              </div>
            </>
          )}
          <div className="w-px h-4 bg-gray-600" />
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 rounded hover:bg-red-600"
            title="Delete edge"
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
              className="px-2 py-1 text-xs bg-transparent border border-violet-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[60px] text-gray-800"
              style={{ boxShadow: "none" }}
              autoFocus
            />
          ) : label ? (
            <div
              onClick={() => setIsEditingLabel(true)}
              onDoubleClick={() => setIsEditingLabel(true)}
              className="px-2 py-1 text-xs bg-transparent border border-transparent cursor-text hover:border-gray-300 rounded text-gray-800"
              style={{ boxShadow: "none" }}
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
              className="px-2 py-1 text-xs text-gray-400 border border-dashed border-gray-300 rounded cursor-text hover:border-violet-300 hover:text-violet-600 min-w-[60px] bg-transparent"
              style={{ boxShadow: "none" }}
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
