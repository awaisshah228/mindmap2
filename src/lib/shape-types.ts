/**
 * Flow chart shape types and SVG path definitions (React Flow Shapes–style).
 * Each path is defined in a 0 0 100 100 viewBox; nodes scale the SVG to their size.
 */
export const SHAPE_TYPES = [
  "rectangle",
  "roundedRect",
  "diamond",
  "circle",
  "hexagon",
  "cylinder",
  "parallelogram",
  "trapezoid",
  "stadium",
  "triangle",
  "document",
  "table",
] as const;

export type ShapeType = (typeof SHAPE_TYPES)[number];

/** SVG path d for shape in 100x100 viewBox. */
export const SHAPE_PATHS: Record<ShapeType, string> = {
  rectangle: "M 0 10 L 0 90 L 100 90 L 100 10 Z",
  roundedRect: "M 15 0 L 85 0 Q 100 0 100 15 L 100 85 Q 100 100 85 100 L 15 100 Q 0 100 0 85 L 0 15 Q 0 0 15 0 Z",
  diamond: "M 50 5 L 95 50 L 50 95 L 5 50 Z",
  circle: "M 50 5 A 45 45 0 1 1 49.99 5 Z",
  hexagon: "M 50 5 L 93 27.5 L 93 72.5 L 50 95 L 7 72.5 L 7 27.5 Z",
  cylinder: "M 15 20 L 15 80 Q 15 95 50 95 Q 85 95 85 80 L 85 20 Q 85 5 50 5 Q 15 5 15 20 Z",
  parallelogram: "M 25 5 L 95 5 L 75 95 L 5 95 Z",
  trapezoid: "M 20 10 L 80 10 L 95 90 L 5 90 Z",
  stadium: "M 15 0 L 85 0 Q 100 0 100 50 Q 100 100 85 100 L 15 100 Q 0 100 0 50 Q 0 0 15 0 Z",
  triangle: "M 50 8 L 95 92 L 5 92 Z",
  document: "M 0 5 L 0 85 L 60 85 L 60 95 L 100 95 L 100 5 Z M 60 85 L 60 75 L 100 75 L 100 85 L 60 85 Z",
  table: "M 0 0 L 100 0 L 100 100 L 0 100 Z", // outline only; grid rendered in component
};

export const SHAPE_LABELS: Record<ShapeType, string> = {
  rectangle: "Rectangle",
  roundedRect: "Rounded",
  diamond: "Diamond",
  circle: "Circle",
  hexagon: "Hexagon",
  cylinder: "Cylinder",
  parallelogram: "Parallelogram",
  trapezoid: "Trapezoid",
  stadium: "Stadium",
  triangle: "Triangle",
  document: "Document",
  table: "Table",
};
