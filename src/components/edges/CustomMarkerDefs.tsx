"use client";

import React, { memo } from "react";

/**
 * Custom SVG marker definitions for edge endpoints.
 *
 * Placed as a sibling BEFORE <ReactFlow> per the official React Flow pattern:
 * https://reactflow.dev/examples/edges/markers
 *
 * React Flow edges reference markers via string: markerEnd="cm-arrow-closed"
 * React Flow internally wraps this as url('#cm-arrow-closed').
 *
 * We use markerUnits="strokeWidth" so marker scales with the edge thickness.
 *
 * For per-edge color/size customisation, use renderDynamicMarker() to generate
 * a <marker> element with a unique ID inside the edge component's SVG context.
 */

/** All marker shape IDs we support */
export const CUSTOM_MARKER_IDS = {
  // ── Basic ──
  arrowOpen: "cm-arrow-open",
  arrowClosed: "cm-arrow-closed",
  circle: "cm-circle",
  circleFilled: "cm-circle-filled",
  diamond: "cm-diamond",
  diamondFilled: "cm-diamond-filled",
  bar: "cm-bar",
  // ── ER Cardinality (Crow's foot / IE notation) ──
  erOne: "cm-er-one",
  erMany: "cm-er-many",
  erOneOnly: "cm-er-one-only",
  erZeroOrOne: "cm-er-zero-or-one",
  erOneOrMany: "cm-er-one-or-many",
  erZeroOrMany: "cm-er-zero-or-many",
  // ── UML ──
  umlComposition: "cm-uml-composition",
  umlAggregation: "cm-uml-aggregation",
  umlInheritance: "cm-uml-inheritance",
  umlRealization: "cm-uml-realization",
} as const;

export type CustomMarkerId = (typeof CUSTOM_MARKER_IDS)[keyof typeof CUSTOM_MARKER_IDS];

/** Get the url(#...) reference string for a custom marker */
export function customMarkerUrl(markerId: string): string {
  return `url(#${markerId})`;
}

/* ═══════════════ Marker shape registry ═══════════════
 * Used by:
 * 1. The static CustomMarkerDefs component (default color/size)
 * 2. renderDynamicMarker() for per-edge colored/sized markers
 */

export type MarkerShapeDef = {
  viewBox: string;
  baseWidth: number;
  baseHeight: number;
  render: (color: string) => React.ReactNode;
};

/** Registry mapping every custom marker ID → its SVG shape definition */
export const MARKER_SHAPES: Record<string, MarkerShapeDef> = {
  /* ── Basic ── */
  [CUSTOM_MARKER_IDS.arrowOpen]: {
    viewBox: "-10 -10 20 20",
    baseWidth: 12,
    baseHeight: 12,
    render: (c) => (
      <polyline points="-5,-4 0,0 -5,4" fill="none" stroke={c} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  [CUSTOM_MARKER_IDS.arrowClosed]: {
    viewBox: "-10 -10 20 20",
    baseWidth: 12,
    baseHeight: 12,
    render: (c) => (
      <polyline points="-5,-4 0,0 -5,4 -5,-4" fill={c} stroke={c} strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
    ),
  },
  [CUSTOM_MARKER_IDS.circle]: {
    viewBox: "-10 -10 20 20",
    baseWidth: 10,
    baseHeight: 10,
    render: (c) => <circle cx="-4" cy="0" r="3.5" fill="white" stroke={c} strokeWidth="1" />,
  },
  [CUSTOM_MARKER_IDS.circleFilled]: {
    viewBox: "-10 -10 20 20",
    baseWidth: 10,
    baseHeight: 10,
    render: (c) => <circle cx="-4" cy="0" r="3.5" fill={c} stroke={c} strokeWidth="0.5" />,
  },
  [CUSTOM_MARKER_IDS.diamond]: {
    viewBox: "-14 -10 28 20",
    baseWidth: 14,
    baseHeight: 10,
    render: (c) => <polygon points="-10,0 -5,-4 0,0 -5,4" fill="white" stroke={c} strokeWidth="1" />,
  },
  [CUSTOM_MARKER_IDS.diamondFilled]: {
    viewBox: "-14 -10 28 20",
    baseWidth: 14,
    baseHeight: 10,
    render: (c) => <polygon points="-10,0 -5,-4 0,0 -5,4" fill={c} stroke={c} strokeWidth="0.5" />,
  },
  [CUSTOM_MARKER_IDS.bar]: {
    viewBox: "-10 -10 20 20",
    baseWidth: 6,
    baseHeight: 10,
    render: (c) => <line x1="0" y1="-4" x2="0" y2="4" stroke={c} strokeWidth="1.2" strokeLinecap="round" />,
  },
  /* ── ER Cardinality ── */
  [CUSTOM_MARKER_IDS.erOne]: {
    viewBox: "-10 -10 20 20",
    baseWidth: 8,
    baseHeight: 10,
    render: (c) => <line x1="0" y1="-4" x2="0" y2="4" stroke={c} strokeWidth="1.2" strokeLinecap="round" />,
  },
  [CUSTOM_MARKER_IDS.erMany]: {
    viewBox: "-14 -10 28 20",
    baseWidth: 14,
    baseHeight: 12,
    render: (c) => (
      <>
        <line x1="-8" y1="-5" x2="0" y2="0" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="-8" y1="5" x2="0" y2="0" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="-8" y1="0" x2="0" y2="0" stroke={c} strokeWidth="1" strokeLinecap="round" />
      </>
    ),
  },
  [CUSTOM_MARKER_IDS.erOneOnly]: {
    viewBox: "-10 -10 20 20",
    baseWidth: 10,
    baseHeight: 10,
    render: (c) => (
      <>
        <line x1="-3" y1="-4" x2="-3" y2="4" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke={c} strokeWidth="1" strokeLinecap="round" />
      </>
    ),
  },
  [CUSTOM_MARKER_IDS.erZeroOrOne]: {
    viewBox: "-16 -10 32 20",
    baseWidth: 16,
    baseHeight: 12,
    render: (c) => (
      <>
        <circle cx="-8" cy="0" r="3" fill="white" stroke={c} strokeWidth="1" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke={c} strokeWidth="1" strokeLinecap="round" />
      </>
    ),
  },
  [CUSTOM_MARKER_IDS.erOneOrMany]: {
    viewBox: "-16 -10 32 20",
    baseWidth: 16,
    baseHeight: 12,
    render: (c) => (
      <>
        <line x1="-10" y1="-4" x2="-10" y2="4" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="-7" y1="-5" x2="0" y2="0" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="-7" y1="5" x2="0" y2="0" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="-7" y1="0" x2="0" y2="0" stroke={c} strokeWidth="1" strokeLinecap="round" />
      </>
    ),
  },
  [CUSTOM_MARKER_IDS.erZeroOrMany]: {
    viewBox: "-18 -10 36 20",
    baseWidth: 18,
    baseHeight: 12,
    render: (c) => (
      <>
        <circle cx="-12" cy="0" r="3" fill="white" stroke={c} strokeWidth="1" />
        <line x1="-6" y1="-5" x2="0" y2="0" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="-6" y1="5" x2="0" y2="0" stroke={c} strokeWidth="1" strokeLinecap="round" />
        <line x1="-6" y1="0" x2="0" y2="0" stroke={c} strokeWidth="1" strokeLinecap="round" />
      </>
    ),
  },
  /* ── UML ── */
  [CUSTOM_MARKER_IDS.umlComposition]: {
    viewBox: "-14 -10 28 20",
    baseWidth: 14,
    baseHeight: 10,
    render: (c) => <polygon points="-10,0 -5,-4 0,0 -5,4" fill={c} stroke={c} strokeWidth="0.5" />,
  },
  [CUSTOM_MARKER_IDS.umlAggregation]: {
    viewBox: "-14 -10 28 20",
    baseWidth: 14,
    baseHeight: 10,
    render: (c) => <polygon points="-10,0 -5,-4 0,0 -5,4" fill="white" stroke={c} strokeWidth="1" />,
  },
  [CUSTOM_MARKER_IDS.umlInheritance]: {
    viewBox: "-10 -10 20 20",
    baseWidth: 12,
    baseHeight: 12,
    render: (c) => <polygon points="-6,-4 0,0 -6,4" fill="white" stroke={c} strokeWidth="1" />,
  },
  [CUSTOM_MARKER_IDS.umlRealization]: {
    viewBox: "-10 -10 20 20",
    baseWidth: 12,
    baseHeight: 12,
    render: (c) => <polygon points="-6,-4 0,0 -6,4" fill="white" stroke={c} strokeWidth="1" />,
  },
};

/* ═══════════════ Dynamic per-edge marker rendering ═══════════════ */

/**
 * Render a `<marker>` element for a specific edge with custom color and scale.
 * Place inside the edge component return – it will be in React Flow's SVG context.
 *
 * @param uniqueId - Unique marker ID (include edge ID for uniqueness)
 * @param baseMarkerId - One of CUSTOM_MARKER_IDS values
 * @param color - Hex or CSS color for the marker
 * @param scale - Size multiplier (1 = default)
 */
export function renderDynamicMarker(
  uniqueId: string,
  baseMarkerId: string,
  color: string,
  scale: number
): React.ReactNode {
  const shape = MARKER_SHAPES[baseMarkerId];
  if (!shape) return null;
  return (
    <marker
      key={uniqueId}
      id={uniqueId}
      viewBox={shape.viewBox}
      markerWidth={shape.baseWidth * scale}
      markerHeight={shape.baseHeight * scale}
      refX="0"
      refY="0"
      orient="auto-start-reverse"
      markerUnits="strokeWidth"
    >
      {shape.render(color)}
    </marker>
  );
}

/* ═══════════════ Static defaults (rendered once) ═══════════════ */

const DEFAULT_COLOR = "#94a3b8";

function CustomMarkerDefsComponent() {
  return (
    <svg style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {Object.entries(MARKER_SHAPES).map(([markerId, shape]) => (
          <marker
            key={markerId}
            id={markerId}
            viewBox={shape.viewBox}
            markerWidth={shape.baseWidth}
            markerHeight={shape.baseHeight}
            refX="0"
            refY="0"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            {shape.render(DEFAULT_COLOR)}
          </marker>
        ))}
      </defs>
    </svg>
  );
}

export const CustomMarkerDefs = memo(CustomMarkerDefsComponent);
