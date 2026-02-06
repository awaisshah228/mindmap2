/**
 * Convert between React Flow diagram (nodes + edges) and Excalidraw elements.
 * Optimized: O(nodes + edges) with a single node lookup map, shared helpers, and shape config.
 */
import type { Node, Edge } from "@xyflow/react";

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 48;

/** Excalidraw element skeleton (simplified) for conversion. */
export type ExcalidrawSkeleton = {
  type: "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line";
  id?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  label?: { text: string };
  backgroundColor?: string;
  strokeColor?: string;
  start?: { id?: string; type?: string };
  end?: { id?: string; type?: string };
};

function getNodeSize(node: Node): [number, number] {
  const w = node.measured?.width ?? node.width ?? DEFAULT_NODE_WIDTH;
  const h = node.measured?.height ?? node.height ?? DEFAULT_NODE_HEIGHT;
  return [Number(w) || DEFAULT_NODE_WIDTH, Number(h) || DEFAULT_NODE_HEIGHT];
}

function getNodeCenter(node: Node): [number, number] {
  const [w, h] = getNodeSize(node);
  const x = node.position?.x ?? 0;
  const y = node.position?.y ?? 0;
  return [x + w / 2, y + h / 2];
}

const SHAPE_CONFIG: Record<string, { type: ExcalidrawSkeleton["type"]; bg: string; stroke: string }> = {
  rectangle: { type: "rectangle", bg: "#e7f5ff", stroke: "#1971c2" },
  document: { type: "rectangle", bg: "#e7f5ff", stroke: "#1971c2" },
  group: { type: "rectangle", bg: "#e7f5ff", stroke: "#1971c2" },
  mindMap: { type: "rectangle", bg: "#e7f5ff", stroke: "#1971c2" },
  stickyNote: { type: "rectangle", bg: "#e7f5ff", stroke: "#1971c2" },
  diamond: { type: "diamond", bg: "#fff3bf", stroke: "#f08c00" },
  circle: { type: "ellipse", bg: "#d3f9d8", stroke: "#2f9e44" },
  ellipse: { type: "ellipse", bg: "#d3f9d8", stroke: "#2f9e44" },
};

/**
 * Convert React Flow nodes and edges to Excalidraw skeleton elements.
 * Uses a node-by-id map for O(1) edge lookups and a shape config for minimal branching.
 */
export function diagramToExcalidraw(nodes: Node[], edges: Edge[]): ExcalidrawSkeleton[] {
  const nodeById = new Map<string, Node>();
  for (let i = 0; i < nodes.length; i++) nodeById.set(nodes[i].id, nodes[i]);

  const elements: ExcalidrawSkeleton[] = [];
  const nodeIdToExcalId = new Map<string, string>();

  for (const node of nodes) {
    const type = (node.type as string) || "rectangle";
    const label = (node.data?.label as string) || "";
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const [w, h] = getNodeSize(node);
    const bg = (node.data?.backgroundColor as string) || (node.data?.branchColor as string);
    const excalId = `ex-${node.id}`;
    nodeIdToExcalId.set(node.id, excalId);

    const config = SHAPE_CONFIG[type] ?? { type: "rectangle" as const, bg: "#f1f3f5", stroke: "#495057" };
    const displayLabel = label || (config.type === "rectangle" && type !== "rectangle" ? type : "");

    elements.push({
      type: config.type,
      id: excalId,
      x,
      y,
      width: w,
      height: h,
      label: { text: displayLabel },
      backgroundColor: bg || config.bg,
      strokeColor: config.stroke,
    });
  }

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const [sx, sy] = getNodeCenter(sourceNode);
    const [tx, ty] = getNodeCenter(targetNode);
    const midX = (sx + tx) / 2;
    const midY = (sy + ty) / 2;
    const edgeLabel = (edge.data?.label as string) || "";
    const startId = nodeIdToExcalId.get(edge.source);
    const endId = nodeIdToExcalId.get(edge.target);
    if (!startId || !endId) continue;

    elements.push({
      type: "arrow",
      id: `ex-e-${edge.id}`,
      x: midX - 50,
      y: midY - 12,
      width: 100,
      height: 24,
      label: edgeLabel ? { text: edgeLabel } : undefined,
      start: { id: startId },
      end: { id: endId },
    });
  }

  return elements;
}

type ExcalidrawEl = {
  type?: string;
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  label?: { text?: string };
  backgroundColor?: string;
  start?: { id?: string };
  end?: { id?: string };
  startBinding?: { elementId?: string };
  endBinding?: { elementId?: string };
};

/**
 * Resolve Excalidraw element id to React Flow node id.
 */
function excalIdToNodeId(id: string, idToNodeId: Map<string, string>): string {
  const mapped = idToNodeId.get(id);
  if (mapped) return mapped;
  if (id.startsWith("ex-")) return id.slice(3);
  return id.startsWith("node-") ? id : `node-${id}`;
}

/**
 * Convert Excalidraw elements (from API/restore) back to React Flow nodes and edges.
 * Two passes: first build nodes and idToNodeId, then edges so arrow bindings resolve.
 */
export function excalidrawToDiagram(elements: unknown[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const elList = Array.isArray(elements) ? elements : [];
  const idToNodeId = new Map<string, string>();

  // Pass 1: shapes and text -> nodes
  for (const el of elList) {
    const e = el as ExcalidrawEl;
    const id = (e.id as string) ?? `el-${nodes.length}`;
    const type = (e.type as string) ?? "rectangle";
    if (type === "arrow" || type === "line") continue;

    const x = Number(e.x) ?? 0;
    const y = Number(e.y) ?? 0;
    const w = Number(e.width) ?? DEFAULT_NODE_WIDTH;
    const h = Number(e.height) ?? DEFAULT_NODE_HEIGHT;
    const text = (e.label?.text ?? e.text ?? "") as string;
    const rfId = id.startsWith("ex-") ? id.slice(3).replace(/^e-/, "edge-") : `node-${id}`;
    let nodeType: string = "rectangle";
    if (type === "diamond") nodeType = "diamond";
    else if (type === "ellipse") nodeType = "circle";
    else if (type === "text" && !e.width) nodeType = "text";

    const nodeId = rfId.startsWith("node-") ? rfId : `node-${rfId}`;
    idToNodeId.set(id, nodeId);
    nodes.push({
      id: nodeId,
      type: nodeType,
      position: { x, y },
      data: { label: text || "Untitled", backgroundColor: e.backgroundColor },
      width: w,
      height: h,
    });
  }

  // Pass 2: arrows -> edges (bindings now resolve via idToNodeId)
  for (const el of elList) {
    const e = el as ExcalidrawEl;
    const type = (e.type as string) ?? "rectangle";
    if (type !== "arrow" && type !== "line") continue;

    const text = (e.label?.text ?? e.text ?? "") as string;
    const startId =
      e.start?.id != null
        ? excalIdToNodeId(e.start.id, idToNodeId)
        : e.startBinding?.elementId != null
          ? excalIdToNodeId(e.startBinding.elementId, idToNodeId)
          : undefined;
    const endId =
      e.end?.id != null
        ? excalIdToNodeId(e.end.id, idToNodeId)
        : e.endBinding?.elementId != null
          ? excalIdToNodeId(e.endBinding.elementId, idToNodeId)
          : undefined;
    if (startId && endId) {
      edges.push({
        id: `e-${startId}-${endId}-${edges.length}`,
        source: startId,
        target: endId,
        data: text ? { label: text } : {},
      });
    }
  }

  return { nodes, edges };
}
