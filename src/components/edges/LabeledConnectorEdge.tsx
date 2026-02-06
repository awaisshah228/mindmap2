"use client";

import { memo, useCallback, useState, useMemo, JSX } from "react";
import {
  EdgeToolbar,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  getStraightPath,
  useReactFlow,
  Position,
  type EdgeMarker,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { getBranchStrokeColor } from "@/lib/branch-colors";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { BaseEdge } from "./BaseEdge";
import { CUSTOM_MARKER_IDS, MARKER_SHAPES, renderDynamicMarker } from "./CustomMarkerDefs";

const EDGE_STROKE_WIDTH = 6;
/** Offset toolbar above the label so it doesn't cover placeholder/input */
const TOOLBAR_OFFSET_Y = -52;
/** Min edge length (px) to show a label so the edge stays visible; also require edge >= label width + this padding */
const MIN_EDGE_LENGTH_FOR_LABEL_PX = 72;
const LABEL_WIDTH_APPROX_PX_PER_CHAR = 7;
const LABEL_PADDING_PX = 32;

type ConnectorType = "smoothstep" | "default" | "straight" | "step";

interface PathPoint {
  x: number;
  y: number;
}

const pathParams = (sp: Position, tp: Position) => ({
  sourcePosition: sp,
  targetPosition: tp,
});

/* ─── Edge gap helper ─── */
/**
 * Offset a point along the direction from `from` → `to` by `gap` pixels.
 * Returns the new (shortened) coordinate.
 */
function offsetPoint(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  gap: number
): { x: number; y: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0 || gap === 0) return { x: fromX, y: fromY };
  const ratio = gap / len;
  return { x: fromX + dx * ratio, y: fromY + dy * ratio };
}

/* ─── ER relationship types ─── */
export type ERRelation =
  | "one-to-one"
  | "one-to-many"
  | "many-to-one"
  | "many-to-many"
  | null;

const ER_RELATIONS: { id: ERRelation; label: string; sourceLabel: string; targetLabel: string }[] = [
  { id: null, label: "None", sourceLabel: "", targetLabel: "" },
  { id: "one-to-one", label: "One to One", sourceLabel: "1", targetLabel: "1" },
  { id: "one-to-many", label: "One to Many", sourceLabel: "1", targetLabel: "*" },
  { id: "many-to-one", label: "Many to One", sourceLabel: "*", targetLabel: "1" },
  { id: "many-to-many", label: "Many to Many", sourceLabel: "*", targetLabel: "*" },
];


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
  const { updateEdgeData, deleteElements, screenToFlowPosition, getEdges, setEdges } = useReactFlow();
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  // Avoid calling getEdges() on every render — only compute branch color when needed
  const branchColor = useMemo(() => {
    if (data?.strokeColor) return data.strokeColor as string;
    const edges = getEdges();
    return getBranchStrokeColor(source, target, edges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, target, data?.strokeColor]);
  const connectorType = (data?.connectorType as ConnectorType) ?? "default";
  const label = (data?.label as string) ?? "";
  const pathPoints = (data?.pathPoints as PathPoint[] | undefined) ?? [];
  const strokeDasharray = (data?.strokeDasharray as string | undefined) ?? undefined;
  const erRelation = (data?.erRelation as ERRelation) ?? null;
  const markerColor = (data?.markerColor as string | undefined) ?? undefined;
  const markerScale = (data?.markerScale as number | undefined) ?? 1;
  const effectivePathPoints = pathPoints;
  const hasCustomPath = effectivePathPoints.length > 0;

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [activeMarkerSide, setActiveMarkerSide] = useState<"start" | "end" | null>(null);
  const [relationOpen, setRelationOpen] = useState(false);
  const [markerColorOpen, setMarkerColorOpen] = useState(false);

  // Use raw source/target coordinates — no gap offset
  const aSourceX = sourceX;
  const aSourceY = sourceY;
  const aTargetX = targetX;
  const aTargetY = targetY;

  const params = {
    sourceX: aSourceX,
    sourceY: aSourceY,
    targetX: aTargetX,
    targetY: aTargetY,
    ...pathParams(sourcePosition, targetPosition),
  };

  const defaultPathResult = hasCustomPath
    ? null
    : connectorType === "straight"
      ? getStraightPath({ sourceX: aSourceX, sourceY: aSourceY, targetX: aTargetX, targetY: aTargetY })
      : connectorType === "default"
        ? getBezierPath({ ...params, curvature: 0.2 })
        : getSmoothStepPath({
            ...params,
            borderRadius: connectorType === "step" ? 0 : 5,
          });

  const edgePath = hasCustomPath
    ? buildCustomPath(aSourceX, aSourceY, aTargetX, aTargetY, effectivePathPoints)
    : defaultPathResult?.[0] ?? "";
  const rawLabelX = defaultPathResult?.[1] ?? (aSourceX + aTargetX) / 2;
  const rawLabelY = defaultPathResult?.[2] ?? (aSourceY + aTargetY) / 2;
  const edgeLength = Math.hypot(aTargetX - aSourceX, aTargetY - aSourceY);
  const labelWidthApprox = (label?.length ?? 0) * LABEL_WIDTH_APPROX_PX_PER_CHAR;
  const minLengthToShowLabel = Math.max(MIN_EDGE_LENGTH_FOR_LABEL_PX, labelWidthApprox + LABEL_PADDING_PX);
  const showLabelByLength = !label || edgeLength >= minLengthToShowLabel;
  const labelX = rawLabelX;
  const labelY = rawLabelY;

  const setConnectorType = useCallback(
    (type: ConnectorType) => {
      pushUndo();
      updateEdgeData(id, { connectorType: type, pathPoints: [] });
    },
    [id, updateEdgeData, pushUndo]
  );

  const handleLabelSave = useCallback(() => {
    pushUndo();
    setIsEditingLabel(false);
    updateEdgeData(id, { label: editValue });
  }, [id, editValue, updateEdgeData, pushUndo]);

  const handleDelete = useCallback(() => {
    pushUndo();
    deleteElements({ edges: [{ id }] });
  }, [id, deleteElements, pushUndo]);

  const handleAddPoint = useCallback(() => {
    pushUndo();
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;
    const newPoints = [...effectivePathPoints, { x: midX, y: midY }];
    updateEdgeData(id, { pathPoints: newPoints });
  }, [id, effectivePathPoints, sourceX, sourceY, targetX, targetY, updateEdgeData, pushUndo]);

  const handleResetPath = useCallback(() => {
    pushUndo();
    updateEdgeData(id, { pathPoints: [] });
  }, [id, updateEdgeData, pushUndo]);

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
    (value: EdgeMarker | string | undefined) => {
      pushUndo();
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, markerEnd: value } : e)));
    },
    [id, setEdges, pushUndo]
  );
  const setMarkerStart = useCallback(
    (value: EdgeMarker | string | undefined) => {
      pushUndo();
      setEdges((eds) => eds.map((e) => (e.id === id ? { ...e, markerStart: value } : e)));
    },
    [id, setEdges, pushUndo]
  );
  const setLineStyle = useCallback(
    (dashed: boolean) => {
      pushUndo();
      updateEdgeData(id, { strokeDasharray: dashed ? "5 5" : undefined });
    },
    [id, updateEdgeData, pushUndo]
  );


  const setRelation = useCallback(
    (rel: ERRelation) => {
      pushUndo();
      updateEdgeData(id, { erRelation: rel });
      setRelationOpen(false);
    },
    [id, updateEdgeData, pushUndo]
  );

  /* ── Flip markers (swap start ↔ end) ── */
  const handleFlipMarkers = useCallback(() => {
    pushUndo();
    setEdges((eds) =>
      eds.map((e) =>
        e.id === id
          ? { ...e, markerStart: e.markerEnd, markerEnd: e.markerStart }
          : e
      )
    );
  }, [id, setEdges, pushUndo]);

  /* ── Marker color ── */
  const setMarkerColor = useCallback(
    (color: string | undefined) => {
      pushUndo();
      updateEdgeData(id, { markerColor: color });
      setMarkerColorOpen(false);
    },
    [id, updateEdgeData, pushUndo]
  );

  /* ── Marker size ── */
  const setMarkerSize = useCallback(
    (scale: number) => {
      pushUndo();
      updateEdgeData(id, { markerScale: scale });
    },
    [id, updateEdgeData, pushUndo]
  );

  /* ── Dynamic per-edge markers for custom color / size ── */
  const needsDynamic = !!(markerColor || markerScale !== 1);

  // Extract raw marker IDs from the markerEnd/markerStart props.
  // React Flow wraps raw string IDs into url('#...'), so we parse them back out.
  const extractRawMarkerId = (marker: string | undefined): string | undefined => {
    if (!marker) return undefined;
    // React Flow format: url('#cm-arrow-closed')
    const match = marker.match(/url\(['"]?#([^'")\s]+)['"]?\)/);
    return match ? match[1] : marker;
  };
  const rawEndId = extractRawMarkerId(markerEnd);
  const rawStartId = extractRawMarkerId(markerStart);

  const dynEndId = needsDynamic && rawEndId ? `${rawEndId}--${id}` : undefined;
  const dynStartId = needsDynamic && rawStartId ? `${rawStartId}--${id}` : undefined;

  const dynamicColor = markerColor ?? "#94a3b8";
  const dynamicScale = markerScale;

  // Override markerEnd/markerStart props if dynamic
  const effectiveMarkerEnd = dynEndId ? `url('#${dynEndId}')` : markerEnd;
  const effectiveMarkerStart = dynStartId ? `url('#${dynStartId}')` : markerStart;

  const effectiveStrokeDasharray = strokeDasharray;

  /* ── Marker color presets ── */
  const MARKER_COLORS = [
    { id: "default", color: undefined, label: "Default", hex: "#94a3b8" },
    { id: "red", color: "#ef4444", label: "Red", hex: "#ef4444" },
    { id: "orange", color: "#f97316", label: "Orange", hex: "#f97316" },
    { id: "yellow", color: "#eab308", label: "Yellow", hex: "#eab308" },
    { id: "green", color: "#22c55e", label: "Green", hex: "#22c55e" },
    { id: "blue", color: "#3b82f6", label: "Blue", hex: "#3b82f6" },
    { id: "purple", color: "#8b5cf6", label: "Purple", hex: "#8b5cf6" },
    { id: "pink", color: "#ec4899", label: "Pink", hex: "#ec4899" },
    { id: "gray", color: "#6b7280", label: "Gray", hex: "#6b7280" },
    { id: "black", color: "#1f2937", label: "Black", hex: "#1f2937" },
  ];

  type MarkerPreset = {
    id: string;
    title: string;
    /** Category for grouping in the UI */
    group: "basic" | "er" | "uml";
    /** Returns the marker ID string, or undefined for none. React Flow wraps it in url(#...) automatically. */
    getMarker: () => string | undefined;
    icon: JSX.Element;
  };

  const MARKER_PRESETS: MarkerPreset[] = [
    /* ─── Basic markers ─── */
    {
      id: "none",
      title: "None",
      group: "basic",
      getMarker: () => undefined,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L26 6" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      id: "arrow-open",
      title: "Arrow (open)",
      group: "basic",
      getMarker: () => CUSTOM_MARKER_IDS.arrowOpen,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L22 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 3 L26 6 L20 9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ),
    },
    {
      id: "arrow-closed",
      title: "Arrow (filled)",
      group: "basic",
      getMarker: () => CUSTOM_MARKER_IDS.arrowClosed,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L20 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 3 L26 6 L20 9 Z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "circle",
      title: "Circle (open)",
      group: "basic",
      getMarker: () => CUSTOM_MARKER_IDS.circle,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L20 6" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="23" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: "circle-filled",
      title: "Circle (filled)",
      group: "basic",
      getMarker: () => CUSTOM_MARKER_IDS.circleFilled,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L20 6" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="23" cy="6" r="3" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "diamond",
      title: "Diamond (open)",
      group: "basic",
      getMarker: () => CUSTOM_MARKER_IDS.diamond,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L18 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 6 L23 3 L26 6 L23 9 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: "diamond-filled",
      title: "Diamond (filled)",
      group: "basic",
      getMarker: () => CUSTOM_MARKER_IDS.diamondFilled,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L18 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 6 L23 3 L26 6 L23 9 Z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "bar",
      title: "Bar ( | )",
      group: "basic",
      getMarker: () => CUSTOM_MARKER_IDS.bar,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L22 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M24 2 L24 10" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    /* ─── ER / Relationship markers (Crow's foot / IE notation) ─── */
    {
      id: "er-one",
      title: "One ( | )",
      group: "er",
      getMarker: () => CUSTOM_MARKER_IDS.erOne,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L22 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M24 2 L24 10" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      id: "er-many",
      title: "Many ( > )",
      group: "er",
      getMarker: () => CUSTOM_MARKER_IDS.erMany,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L18 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M18 2 L26 6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M18 10 L26 6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M18 6 L26 6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: "er-one-only",
      title: "One & Only One ( || )",
      group: "er",
      getMarker: () => CUSTOM_MARKER_IDS.erOneOnly,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L20 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M22 2 L22 10" stroke="currentColor" strokeWidth="1.5" />
          <path d="M25 2 L25 10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: "er-zero-or-one",
      title: "Zero or One ( o| )",
      group: "er",
      getMarker: () => CUSTOM_MARKER_IDS.erZeroOrOne,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L16 6" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="19" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M25 2 L25 10" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: "er-one-or-many",
      title: "One or Many ( |> )",
      group: "er",
      getMarker: () => CUSTOM_MARKER_IDS.erOneOrMany,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L14 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M15 2 L15 10" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 2 L25 6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 10 L25 6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 6 L25 6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: "er-zero-or-many",
      title: "Zero or Many ( o> )",
      group: "er",
      getMarker: () => CUSTOM_MARKER_IDS.erZeroOrMany,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L12 6" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="15" cy="6" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M19 2 L27 6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M19 10 L27 6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M19 6 L27 6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    /* ─── UML markers ─── */
    {
      id: "uml-composition",
      title: "Composition ( ◆ )",
      group: "uml",
      getMarker: () => CUSTOM_MARKER_IDS.umlComposition,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L16 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M18 6 L22 3 L26 6 L22 9 Z" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: "uml-aggregation",
      title: "Aggregation ( ◇ )",
      group: "uml",
      getMarker: () => CUSTOM_MARKER_IDS.umlAggregation,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L16 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M18 6 L22 3 L26 6 L22 9 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: "uml-inheritance",
      title: "Inheritance ( △ )",
      group: "uml",
      getMarker: () => CUSTOM_MARKER_IDS.umlInheritance,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L18 6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M20 2 L26 6 L20 10 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ),
    },
    {
      id: "uml-realization",
      title: "Realization ( ▷ )",
      group: "uml",
      getMarker: () => CUSTOM_MARKER_IDS.umlRealization,
      icon: (
        <svg width="28" height="12" viewBox="0 0 28 12" fill="none">
          <path d="M2 6 L18 6" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2 2" />
          <path d="M20 2 L26 6 L20 10 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Dynamic per-edge marker defs (custom color/size) */}
      {needsDynamic && (
        <defs>
          {dynEndId && rawEndId && MARKER_SHAPES[rawEndId] && renderDynamicMarker(dynEndId, rawEndId, dynamicColor, dynamicScale)}
          {dynStartId && rawStartId && MARKER_SHAPES[rawStartId] && renderDynamicMarker(dynStartId, rawStartId, dynamicColor, dynamicScale)}
        </defs>
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        selected={selected}
        strokeColor={branchColor}
        strokeWidth={EDGE_STROKE_WIDTH}
        markerEnd={effectiveMarkerEnd}
        markerStart={effectiveMarkerStart}
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
                  "p-1.5 rounded hover:bg-gray-600 flex items-center gap-0.5",
                  markerStart && "bg-violet-600"
                )}
              >
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                  <path d="M4 5 L0 0 L0 10 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <path d="M4 5 L14 5" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <svg width="6" height="6" viewBox="0 0 6 6" fill="none" className="opacity-60"><path d="M1 2 L3 4 L5 2" stroke="currentColor" strokeWidth="1.2" /></svg>
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveMarkerSide((side) => (side === "end" ? null : "end"))
                }
                title="End marker"
                className={cn(
                  "p-1.5 rounded hover:bg-gray-600 flex items-center gap-0.5",
                  markerEnd && "bg-violet-600"
                )}
              >
                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                  <path d="M0 5 L10 5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 5 L14 0 L14 10 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
                </svg>
                <svg width="6" height="6" viewBox="0 0 6 6" fill="none" className="opacity-60"><path d="M1 2 L3 4 L5 2" stroke="currentColor" strokeWidth="1.2" /></svg>
              </button>
              {activeMarkerSide && (
                <div className="absolute top-full left-0 mt-1 z-[200] rounded-lg bg-gray-900 text-white shadow-lg border border-gray-700 px-2 py-2 min-w-[180px] max-h-[320px] overflow-y-auto">
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 px-1 mb-1">
                    {activeMarkerSide === "start" ? "Start marker" : "End marker"}
                  </div>
                  {/* Basic markers */}
                  <div className="text-[9px] uppercase tracking-wider text-gray-500 px-1 mt-1 mb-0.5">Basic</div>
                  <div className="flex flex-col gap-0.5">
                    {MARKER_PRESETS.filter((p) => p.group === "basic").map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          const marker = preset.getMarker();
                          if (activeMarkerSide === "start") {
                            setMarkerStart(marker);
                          } else {
                            setMarkerEnd(marker);
                          }
                          setActiveMarkerSide(null);
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-gray-800"
                      >
                        <span className="shrink-0 text-gray-200">{preset.icon}</span>
                        <span className="truncate">{preset.title}</span>
                      </button>
                    ))}
                  </div>
                  {/* ER / Relation markers */}
                  <div className="text-[9px] uppercase tracking-wider text-gray-500 px-1 mt-2 mb-0.5">ER / Crow&apos;s Foot</div>
                  <div className="flex flex-col gap-0.5">
                    {MARKER_PRESETS.filter((p) => p.group === "er").map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          const marker = preset.getMarker();
                          if (activeMarkerSide === "start") {
                            setMarkerStart(marker);
                          } else {
                            setMarkerEnd(marker);
                          }
                          setActiveMarkerSide(null);
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-gray-800"
                      >
                        <span className="shrink-0 text-gray-200">{preset.icon}</span>
                        <span className="truncate">{preset.title}</span>
                      </button>
                    ))}
                  </div>
                  {/* UML markers */}
                  <div className="text-[9px] uppercase tracking-wider text-gray-500 px-1 mt-2 mb-0.5">UML</div>
                  <div className="flex flex-col gap-0.5">
                    {MARKER_PRESETS.filter((p) => p.group === "uml").map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          const marker = preset.getMarker();
                          if (activeMarkerSide === "start") {
                            setMarkerStart(marker);
                          } else {
                            setMarkerEnd(marker);
                          }
                          setActiveMarkerSide(null);
                        }}
                        className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-gray-800"
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
          {/* Flip / Color / Size */}
          {(markerStart || markerEnd) && (
            <>
              <div className="w-px h-4 bg-gray-600" />
              <div className="flex items-center gap-1">
                {/* Flip */}
                <button
                  type="button"
                  onClick={handleFlipMarkers}
                  title="Flip markers (swap start ↔ end)"
                  className="p-1.5 rounded hover:bg-gray-600"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
                {/* Color */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMarkerColorOpen((o) => !o)}
                    title="Marker color"
                    className="p-1.5 rounded hover:bg-gray-600 flex items-center gap-0.5"
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm border border-gray-500"
                      style={{ backgroundColor: markerColor ?? "#94a3b8" }}
                    />
                    <svg width="6" height="6" viewBox="0 0 6 6" fill="none" className="opacity-60"><path d="M1 2 L3 4 L5 2" stroke="currentColor" strokeWidth="1.2" /></svg>
                  </button>
                  {markerColorOpen && (
                    <div className="absolute top-full left-0 mt-1 z-[200] rounded-lg bg-gray-900 text-white shadow-lg border border-gray-700 p-2">
                      <div className="text-[9px] uppercase tracking-wider text-gray-500 px-0.5 mb-1">Marker Color</div>
                      <div className="grid grid-cols-5 gap-1">
                        {MARKER_COLORS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setMarkerColor(c.color)}
                            title={c.label}
                            className={cn(
                              "w-5 h-5 rounded-sm border hover:scale-110 transition-transform",
                              (markerColor ?? undefined) === c.color
                                ? "border-white ring-1 ring-violet-400"
                                : "border-gray-600"
                            )}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Size */}
                <button
                  type="button"
                  onClick={() => setMarkerSize(Math.max(0.5, markerScale - 0.25))}
                  title="Decrease marker size"
                  disabled={markerScale <= 0.5}
                  className="p-1 rounded hover:bg-gray-600 disabled:opacity-30 text-[10px] font-bold"
                >
                  −
                </button>
                <span className="text-[9px] text-gray-400 min-w-[2ch] text-center">{Math.round(markerScale * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setMarkerSize(Math.min(3, markerScale + 0.25))}
                  title="Increase marker size"
                  disabled={markerScale >= 3}
                  className="p-1 rounded hover:bg-gray-600 disabled:opacity-30 text-[10px] font-bold"
                >
                  +
                </button>
              </div>
            </>
          )}
          {/* Label customization */}
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
          {/* ER Relation */}
          <div className="w-px h-4 bg-gray-600" />
          <div className="relative flex items-center gap-1">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mr-0.5">Relation</span>
            <button
              type="button"
              onClick={() => setRelationOpen((o) => !o)}
              title="Set cardinality"
              className={cn(
                "px-2 py-1 rounded hover:bg-gray-600 text-xs whitespace-nowrap flex items-center gap-1",
                erRelation && "bg-violet-600"
              )}
            >
              {erRelation
                ? ER_RELATIONS.find((r) => r.id === erRelation)?.label ?? "Custom"
                : "None"}
              <svg width="6" height="6" viewBox="0 0 6 6" fill="none" className="opacity-60"><path d="M1 2 L3 4 L5 2" stroke="currentColor" strokeWidth="1.2" /></svg>
            </button>
            {relationOpen && (
              <div className="absolute top-full left-0 mt-1 z-[200] rounded-lg bg-gray-900 text-white shadow-lg border border-gray-700 px-2 py-2 min-w-[140px]">
                <div className="text-[10px] uppercase tracking-wide text-gray-400 px-1 mb-1">Cardinality</div>
                <div className="flex flex-col gap-0.5">
                  {ER_RELATIONS.map((rel) => (
                    <button
                      key={rel.id ?? "none"}
                      type="button"
                      onClick={() => setRelation(rel.id)}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-gray-800",
                        erRelation === rel.id && "bg-violet-600"
                      )}
                    >
                      <span className="w-8 text-center font-mono text-gray-300">
                        {rel.id ? `${rel.sourceLabel}:${rel.targetLabel}` : "—"}
                      </span>
                      <span className="truncate">{rel.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
      <EdgeLabelRenderer>
        {/* ER Cardinality badges near source and target */}
        {erRelation && (() => {
          const relDef = ER_RELATIONS.find((r) => r.id === erRelation);
          if (!relDef) return null;
          // Position badges 20px from the source/target along the edge direction
          const sOff = offsetPoint(aSourceX, aSourceY, aTargetX, aTargetY, 20);
          const tOff = offsetPoint(aTargetX, aTargetY, aSourceX, aSourceY, 20);
          return (
            <>
              {relDef.sourceLabel && (
                <div
                  style={{
                    position: "absolute",
                    transform: `translate(-50%, -50%) translate(${sOff.x}px,${sOff.y}px)`,
                    pointerEvents: "none",
                  }}
                  className="nodrag nokey"
                >
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-white border border-gray-300 text-gray-700 shadow-sm font-mono">
                    {relDef.sourceLabel}
                  </span>
                </div>
              )}
              {relDef.targetLabel && (
                <div
                  style={{
                    position: "absolute",
                    transform: `translate(-50%, -50%) translate(${tOff.x}px,${tOff.y}px)`,
                    pointerEvents: "none",
                  }}
                  className="nodrag nokey"
                >
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-white border border-gray-300 text-gray-700 shadow-sm font-mono">
                    {relDef.targetLabel}
                  </span>
                </div>
              )}
            </>
          );
        })()}
        {/* Edge label — only when edge is long enough for the label (or user is editing) so the edge stays visible */}
        {((label && showLabelByLength) || isEditingLabel) && (
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
              className="px-2.5 py-1 text-xs bg-white border border-violet-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[60px] text-gray-800"
              autoFocus
            />
          ) : (
            <div
              onClick={() => { setEditValue(label); setIsEditingLabel(true); }}
              onDoubleClick={() => { setEditValue(label); setIsEditingLabel(true); }}
              className="px-2.5 py-0.5 text-xs bg-white border border-gray-200 rounded-md shadow-sm cursor-text hover:border-violet-300 text-gray-700 font-medium"
            >
              {label}
            </div>
          )}
        </div>
        )}
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
                  pushUndo();
                  const newPoints = effectivePathPoints.filter((_, idx) => idx !== i);
                  updateEdgeData(id, { pathPoints: newPoints });
                }
              }}
              title="Drag to move • Delete to remove"
            />
          ))}
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(LabeledConnectorEdge);
