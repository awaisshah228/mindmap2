import type { Node, Edge } from "@xyflow/react";
import { Position } from "@xyflow/react";

export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

export type LayoutSpacing = [number, number];

export type LayoutAlgorithm =
  | "elk-layered"
  | "elk-mrtree"
  | "elk-box"
  | "elk-force"
  | "elk-radial"
  | "elk-stress"
  | "dagre"
  | "d3-tree"
  | "d3-cluster";

const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 50;
const MIND_MAP_NODE_WIDTH = 170;
const MIND_MAP_NODE_HEIGHT = 44;
const ROOT_LEFT_PADDING = 80;

function getNodeSize(node: Node) {
  const isMindMap = node.type === "mindMap";
  const defW = isMindMap ? MIND_MAP_NODE_WIDTH : DEFAULT_NODE_WIDTH;
  const defH = isMindMap ? MIND_MAP_NODE_HEIGHT : DEFAULT_NODE_HEIGHT;
  const w = (node.measured?.width ?? defW) || defW;
  const h = (node.measured?.height ?? defH) || defH;
  return { width: Number(w) || defW, height: Number(h) || defH };
}

function directionToElk(direction: LayoutDirection): string {
  switch (direction) {
    case "TB": return "DOWN";
    case "BT": return "UP";
    case "LR": return "RIGHT";
    case "RL": return "LEFT";
    default: return "RIGHT";
  }
}

export function getHandlePositions(direction: LayoutDirection) {
  switch (direction) {
    case "TB": return { target: Position.Top, source: Position.Bottom };
    case "BT": return { target: Position.Bottom, source: Position.Top };
    case "LR": return { target: Position.Left, source: Position.Right };
    case "RL": return { target: Position.Right, source: Position.Left };
    default: return { target: Position.Left, source: Position.Right };
  }
}

export function getHandleIds(direction: LayoutDirection): { target: string; source: string } {
  switch (direction) {
    case "TB": return { target: "top", source: "bottom" };
    case "BT": return { target: "bottom", source: "top" };
    case "LR": return { target: "left", source: "right" };
    case "RL": return { target: "right", source: "left" };
    default: return { target: "left", source: "right" };
  }
}

async function layoutWithElk(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
  spacing: LayoutSpacing,
  algorithm: string
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const ELK = (await import("elkjs")).default;
  const elk = new ELK();

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": algorithm,
      "elk.direction": directionToElk(direction),
      "elk.spacing.nodeNode": String(spacing[0]),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(spacing[1]),
    },
    children: nodes.map((node) => {
      const { width, height } = getNodeSize(node);
      return {
        id: node.id,
        width,
        height,
      };
    }),
    edges: edges.map((e, i) => ({
      id: e.id || `e${i}`,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layoutedGraph = await elk.layout(graph);
  const { target: targetPos, source: sourcePos } = getHandlePositions(direction);

  const layoutedNodes: Node[] = (layoutedGraph.children ?? []).map((child) => {
    const node = nodes.find((n) => n.id === child.id)!;
    const elkNode = child as { x?: number; y?: number };
    return {
      ...node,
      targetPosition: targetPos,
      sourcePosition: sourcePos,
      position: {
        x: elkNode.x ?? 0,
        y: elkNode.y ?? 0,
      },
    };
  });

  const shifted = shiftLayoutLeft(layoutedNodes, ROOT_LEFT_PADDING);
  const normalizedEdges = normalizeMindMapEdgeHandles(shifted, edges, direction);
  return { nodes: shifted, edges: normalizedEdges };
}

/** Shift all nodes left so the leftmost node is at padding (root pulled back on x-axis). */
function shiftLayoutLeft(nodes: Node[], leftPadding: number): Node[] {
  const mindMapNodes = nodes.filter((n) => n.type === "mindMap");
  if (mindMapNodes.length === 0) return nodes;
  const minX = Math.min(...mindMapNodes.map((n) => n.position.x));
  const dx = minX - leftPadding;
  if (Math.abs(dx) < 1) return nodes;
  return nodes.map((n) => ({
    ...n,
    position: { x: n.position.x - dx, y: n.position.y },
  }));
}

export function normalizeMindMapEdgeHandles(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection
): Edge[] {
  const mindMapIds = new Set(nodes.filter((n) => n.type === "mindMap").map((n) => n.id));
  const { target: targetId, source: sourceId } = getHandleIds(direction);
  return edges.map((e) => {
    if (!mindMapIds.has(e.source) && !mindMapIds.has(e.target)) return e;
    return { ...e, sourceHandle: sourceId, targetHandle: targetId };
  });
}

async function layoutWithDagre(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
  spacing: LayoutSpacing
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const dagreModule = await import("@dagrejs/dagre");
  const dagre = "default" in dagreModule && dagreModule.default ? dagreModule.default : (dagreModule as { graphlib: unknown; layout: (g: unknown) => void });
  const Graph = (dagre as { graphlib?: { Graph: new () => import("@dagrejs/graphlib").Graph } }).graphlib?.Graph;
  const layoutFn = (dagre as { layout?: (g: unknown) => void }).layout;
  if (!Graph || !layoutFn) {
    const { target: targetPos, source: sourcePos } = getHandlePositions(direction);
    const layoutedNodes = nodes.map((node) => ({
      ...node,
      targetPosition: targetPos,
      sourcePosition: sourcePos,
    }));
    return { nodes: layoutedNodes, edges: normalizeMindMapEdgeHandles(layoutedNodes, edges, direction) };
  }

  const mindMapIds = new Set(nodes.filter((n) => n.type === "mindMap").map((n) => n.id));
  const mindMapEdges = edges.filter((e) => mindMapIds.has(e.source) && mindMapIds.has(e.target));
  const dagreGraph = new Graph().setDefaultEdgeLabel(() => ({}));

  const { target: targetPos, source: sourcePos } = getHandlePositions(direction);
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: spacing[0],
    ranksep: spacing[1],
  });

  nodes.forEach((node) => {
    if (!mindMapIds.has(node.id)) return;
    const { width, height } = getNodeSize(node);
    dagreGraph.setNode(node.id, { width, height });
  });

  mindMapEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  layoutFn(dagreGraph);

  const layoutedNodes: Node[] = nodes.map((node) => {
    const { width, height } = getNodeSize(node);
    const nodeWithPosition = mindMapIds.has(node.id) ? dagreGraph.node(node.id) : null;
    const hasPosition = nodeWithPosition && typeof nodeWithPosition.x === "number" && typeof nodeWithPosition.y === "number";
    return {
      ...node,
      targetPosition: targetPos,
      sourcePosition: sourcePos,
      position: hasPosition
        ? { x: nodeWithPosition.x - width / 2, y: nodeWithPosition.y - height / 2 }
        : node.position ?? { x: 0, y: 0 },
    };
  });

  const shifted = shiftLayoutLeft(layoutedNodes, ROOT_LEFT_PADDING);
  const normalizedEdges = normalizeMindMapEdgeHandles(shifted, edges, direction);
  return { nodes: shifted, edges: normalizedEdges };
}

async function layoutWithD3Hierarchy(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
  spacing: LayoutSpacing,
  variant: "tree" | "cluster"
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const d3 = await import("d3-hierarchy");
  const rootId = nodes.find((n) => n.type === "mindMap" && !edges.some((e) => e.target === n.id))?.id;
  if (!rootId) return { nodes, edges };

  const data = nodes.map((n) => ({
    id: n.id,
    parentId: edges.find((e) => e.target === n.id)?.source ?? (n.id === rootId ? "" : null),
  }));
  const root = d3.stratify<{ id: string; parentId: string | null }>()
    .id((d) => d.id)
    .parentId((d) => (d.parentId === "" ? null : d.parentId))(data);

  const [nodeW, nodeH] = spacing;
  const rootAsUnknown = root as import("d3-hierarchy").HierarchyNode<unknown>;
  const layoutRoot =
    variant === "cluster"
      ? d3.cluster().nodeSize([nodeW, nodeH])(rootAsUnknown)
      : d3.tree().nodeSize([nodeW, nodeH])(rootAsUnknown);

  const { target: targetPos, source: sourcePos } = getHandlePositions(direction);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const layoutedNodes: Node[] = layoutRoot.descendants().map((d) => {
    const node = nodeMap.get((d.data as { id: string }).id)!;
    const { width, height } = getNodeSize(node);
    let x = d.x - width / 2;
    let y = d.y - height / 2;
    switch (direction) {
      case "LR":
        [x, y] = [d.y - height / 2, d.x - width / 2];
        break;
      case "RL":
        [x, y] = [-d.y - height / 2, d.x - width / 2];
        break;
      case "BT":
        [x, y] = [d.x - width / 2, -d.y - height / 2];
        break;
      default:
        break;
    }
    return {
      ...node,
      targetPosition: targetPos,
      sourcePosition: sourcePos,
      position: { x, y },
    };
  });

  const shifted = shiftLayoutLeft(layoutedNodes, ROOT_LEFT_PADDING);
  const normalizedEdges = normalizeMindMapEdgeHandles(shifted, edges, direction);
  return { nodes: shifted, edges: normalizedEdges };
}

const ELK_ALGORITHM_MAP: Record<string, string> = {
  "elk-layered": "layered",
  "elk-mrtree": "mrtree",
  "elk-box": "box",
  "elk-force": "force",
  "elk-radial": "radial",
  "elk-stress": "stress",
};

export async function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "LR",
  spacing: LayoutSpacing = [80, 60],
  algorithm: LayoutAlgorithm = "elk-layered"
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  if (algorithm === "dagre") {
    return layoutWithDagre(nodes, edges, direction, spacing);
  }
  if (algorithm === "d3-tree" || algorithm === "d3-cluster") {
    return layoutWithD3Hierarchy(nodes, edges, direction, spacing, algorithm === "d3-cluster" ? "cluster" : "tree");
  }

  const elkAlgo = ELK_ALGORITHM_MAP[algorithm] ?? "layered";
  return layoutWithElk(nodes, edges, direction, spacing, elkAlgo);
}

export type AlgorithmFamily = "elk" | "dagre" | "d3";

export const ALGORITHM_FAMILIES: { value: AlgorithmFamily; label: string }[] = [
  { value: "elk", label: "ELK" },
  { value: "dagre", label: "Dagre" },
  { value: "d3", label: "D3 Hierarchy" },
];

export const ALGORITHM_SUB_OPTIONS: Record<AlgorithmFamily, { value: LayoutAlgorithm; label: string }[]> = {
  elk: [
    { value: "elk-layered", label: "Layered" },
    { value: "elk-mrtree", label: "Mr. Tree" },
    { value: "elk-box", label: "Box" },
    { value: "elk-force", label: "Force" },
    { value: "elk-radial", label: "Radial" },
    { value: "elk-stress", label: "Stress" },
  ],
  dagre: [{ value: "dagre", label: "Default" }],
  d3: [
    { value: "d3-tree", label: "Tree" },
    { value: "d3-cluster", label: "Cluster" },
  ],
};

export function getAlgorithmFamily(algorithm: LayoutAlgorithm): AlgorithmFamily {
  if (algorithm === "dagre") return "dagre";
  if (algorithm === "d3-tree" || algorithm === "d3-cluster") return "d3";
  return "elk";
}

export function getDefaultAlgorithmForFamily(family: AlgorithmFamily): LayoutAlgorithm {
  const opts = ALGORITHM_SUB_OPTIONS[family];
  return opts[0]?.value ?? "elk-layered";
}

export const LAYOUT_ALGORITHMS: { value: LayoutAlgorithm; label: string }[] = [
  ...ALGORITHM_SUB_OPTIONS.elk,
  ...ALGORITHM_SUB_OPTIONS.dagre,
  ...ALGORITHM_SUB_OPTIONS.d3,
];
