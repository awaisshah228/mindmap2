import type { Node, Edge } from "@xyflow/react";
import { Position } from "@xyflow/react";

export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

export type LayoutSpacing = [number, number];

export type LayoutAlgorithm =
  | "dagre"
  | "d3-tree"
  | "d3-cluster"
  | "elk-layered"
  | "elk-mrtree"
  | "elk-box"
  | "elk-force"
  | "elk-radial"
  | "elk-stress";

const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 50;
const MIND_MAP_NODE_WIDTH = 170;
const MIND_MAP_NODE_HEIGHT = 44;
const IMAGE_NODE_WIDTH = 160;
const IMAGE_NODE_HEIGHT = 120;
const DATABASE_SCHEMA_WIDTH = 200;
const DATABASE_SCHEMA_HEIGHT = 180;
const SERVICE_NODE_WIDTH = 160;
const SERVICE_NODE_HEIGHT = 72;
const QUEUE_NODE_WIDTH = 140;
const QUEUE_NODE_HEIGHT = 64;
const ACTOR_NODE_WIDTH = 100;
const ACTOR_NODE_HEIGHT = 100;
const ICON_NODE_SIZE = 64;
const ROOT_LEFT_PADDING = 80;

const GROUP_NODE_DEFAULT_WIDTH = 280;
const GROUP_NODE_DEFAULT_HEIGHT = 200;

function getNodeSize(node: Node) {
  const isMindMap = node.type === "mindMap";
  const isImage = node.type === "image";
  const isDatabaseSchema = node.type === "databaseSchema";
  const isService = node.type === "service";
  const isQueue = node.type === "queue";
  const isActor = node.type === "actor";
  const isGroup = node.type === "group";
  const isIcon = node.type === "icon";
  let defW = DEFAULT_NODE_WIDTH;
  let defH = DEFAULT_NODE_HEIGHT;
  if (isMindMap) {
    defW = MIND_MAP_NODE_WIDTH;
    defH = MIND_MAP_NODE_HEIGHT;
  } else if (isImage) {
    defW = IMAGE_NODE_WIDTH;
    defH = IMAGE_NODE_HEIGHT;
  } else if (isDatabaseSchema) {
    defW = DATABASE_SCHEMA_WIDTH;
    defH = DATABASE_SCHEMA_HEIGHT;
  } else if (isService) {
    defW = SERVICE_NODE_WIDTH;
    defH = SERVICE_NODE_HEIGHT;
  } else if (isQueue) {
    defW = QUEUE_NODE_WIDTH;
    defH = QUEUE_NODE_HEIGHT;
  } else if (isActor) {
    defW = ACTOR_NODE_WIDTH;
    defH = ACTOR_NODE_HEIGHT;
  } else if (isIcon) {
    defW = ICON_NODE_SIZE;
    defH = ICON_NODE_SIZE;
  } else if (isGroup) {
    defW = GROUP_NODE_DEFAULT_WIDTH;
    defH = GROUP_NODE_DEFAULT_HEIGHT;
  }
  if (isGroup && node.style && (node.style.width != null || node.style.height != null)) {
    const w = Number(node.style.width) || defW;
    const h = Number(node.style.height) || defH;
    return { width: w, height: h };
  }
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

/**
 * ELK layout: same pattern as React Flow's official example.
 * - Graph: { id: 'root', layoutOptions, children: [{ id, width, height, ... }], edges: [{ id, sources: [id], targets: [id] }] }
 * - After layout: each node has x, y → we set position: { x: node.x, y: node.y }
 * @see https://reactflow.dev/examples/layout/elkjs
 * @see https://www.eclipse.org/elk/reference/algorithms.html
 * @see https://www.eclipse.org/elk/reference/options.html
 */
type ElkNode = { id: string; width: number; height: number; x?: number; y?: number; children?: ElkNode[]; edges?: { id: string; sources: string[]; targets: string[] }[] };

function getRootId(nodeId: string, nodes: Node[]): string {
  const node = nodes.find((n) => n.id === nodeId);
  return node?.parentId ? getRootId(node.parentId, nodes) : nodeId;
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
  const { target: targetPos, source: sourcePos } = getHandlePositions(direction);

  const rootNodes = nodes.filter((n) => !n.parentId);
  const rootIds = new Set(rootNodes.map((n) => n.id));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const hasGroups = rootNodes.some((n) => n.type === "group");
  const layoutOptions = {
    "elk.algorithm": algorithm,
    "elk.direction": directionToElk(direction),
    "elk.spacing.nodeNode": String(spacing[0]),
    "elk.layered.spacing.nodeNodeBetweenLayers": String(spacing[1]),
  };

  function buildElkNode(node: Node): ElkNode {
    const { width, height } = getNodeSize(node);
    if (node.type === "group") {
      const children = nodes.filter((n) => n.parentId === node.id);
      const childIds = new Set(children.map((c) => c.id));
      const groupEdges = edges.filter((e) => childIds.has(e.source) && childIds.has(e.target));
      const childrenElk = children.map((c) => {
        const { width: cw, height: ch } = getNodeSize(c);
        return { id: c.id, width: cw, height: ch };
      });
      const padding = GROUP_PADDING;
      const contentW =
        childrenElk.length > 0
          ? Math.max(...childrenElk.map((c) => c.width)) + (childrenElk.length > 1 ? spacing[0] * (childrenElk.length - 1) : 0)
          : width;
      const contentH =
        childrenElk.length > 0
          ? childrenElk.reduce((sum, c) => sum + c.height, 0) + (childrenElk.length > 1 ? spacing[1] * (childrenElk.length - 1) : 0)
          : height;
      const groupW = Math.max(width, contentW + 2 * padding, GROUP_NODE_DEFAULT_WIDTH);
      const groupH = Math.max(height, contentH + 2 * padding, GROUP_NODE_DEFAULT_HEIGHT);
      return {
        id: node.id,
        width: groupW,
        height: groupH,
        children: childrenElk,
        edges: groupEdges.map((e, i) => ({
          id: e.id || `e${i}`,
          sources: [e.source],
          targets: [e.target],
        })),
      };
    }
    return { id: node.id, width, height };
  }

  const rootEdgesForElk = hasGroups
    ? edges
        .map((e) => ({
          id: e.id,
          sources: [getRootId(e.source, nodes)],
          targets: [getRootId(e.target, nodes)],
        }))
        .filter((e) => e.sources[0] !== e.targets[0])
    : edges.filter((e) => rootIds.has(e.source) && rootIds.has(e.target));

  const graph = {
    id: "root",
    layoutOptions: layoutOptions,
    children: rootNodes.map((node) => buildElkNode(node)),
    edges: rootEdgesForElk.map((e: { id?: string; source?: string; target?: string; sources?: string[]; targets?: string[] }, i) => ({
      id: e.id || `root-e${i}`,
      sources: [e.sources?.[0] ?? e.source ?? ""],
      targets: [e.targets?.[0] ?? e.target ?? ""],
    })),
  };

  const layoutedGraph = (await elk.layout(graph)) as { children?: ElkNode[] };
  const byId = new Map<string, Node>();

  function applyElkLayout(elkNode: ElkNode): void {
    const node = nodeById.get(elkNode.id);
    if (!node) return;
    const x = elkNode.x ?? 0;
    const y = elkNode.y ?? 0;
    byId.set(elkNode.id, {
      ...node,
      targetPosition: targetPos,
      sourcePosition: sourcePos,
      position: { x, y },
    });
    if (elkNode.children?.length) {
      for (const ch of elkNode.children) {
        applyElkLayout(ch);
      }
    }
  }

  for (const child of layoutedGraph.children ?? []) {
    applyElkLayout(child);
  }

  const layoutedRootNodes = (layoutedGraph.children ?? [])
    .map((c) => byId.get(c.id))
    .filter((n): n is Node => n != null);
  const shiftedRoots = shiftLayoutLeft(layoutedRootNodes, ROOT_LEFT_PADDING);
  const shiftedById = new Map(shiftedRoots.map((n) => [n.id, n]));

  const allNodes: Node[] = nodes.map((n) => {
    if (shiftedById.has(n.id)) return shiftedById.get(n.id)!;
    if (byId.has(n.id)) return byId.get(n.id)!;
    return { ...n, targetPosition: targetPos, sourcePosition: sourcePos };
  });

  const normalizedEdges = normalizeMindMapEdgeHandles(allNodes, edges, direction);
  return { nodes: allNodes, edges: normalizedEdges };
}

const GROUP_PADDING = 64;
const GROUP_HEADER_INSET = 44;

export type GroupMetadata = { id: string; label: string; nodeIds: string[] };

/**
 * Apply grouping at render time: create group nodes from metadata and set parentId
 * + extent: "parent" on every child so that dragging the group moves all its children.
 * All input nodes are flat; output has group nodes and children with positions
 * relative to the group (like selection grouping). Node order: each group appears
 * before its children so React Flow hierarchy works correctly.
 */
export function applyGroupingFromMetadata(
  flatNodes: Node[],
  groups: GroupMetadata[]
): Node[] {
  if (!groups?.length) return flatNodes;
  const nodeById = new Map(flatNodes.map((n) => [n.id, { ...n }]));
  const result = flatNodes.map((n) => ({ ...n }));

  for (const g of groups) {
    const nodeIds = (g.nodeIds || []).filter((id) => nodeById.has(id));
    if (nodeIds.length === 0) continue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of nodeIds) {
      const node = nodeById.get(id)!;
      const { width, height } = getNodeSize(node);
      const x = node.position?.x ?? 0;
      const y = node.position?.y ?? 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + width > maxX) maxX = x + width;
      if (y + height > maxY) maxY = y + height;
    }

    const groupW = maxX - minX + 2 * GROUP_PADDING;
    const groupH = maxY - minY + 2 * GROUP_PADDING + GROUP_HEADER_INSET;
    const groupX = minX - GROUP_PADDING;
    const groupY = minY - GROUP_HEADER_INSET - GROUP_PADDING;

    const groupNode: Node = {
      id: g.id,
      type: "group",
      position: { x: groupX, y: groupY },
      data: { label: g.label ?? g.id },
      style: { width: groupW, height: groupH },
    };
    result.push(groupNode);
    nodeById.set(g.id, groupNode);

    for (let i = 0; i < result.length; i++) {
      if (!nodeIds.includes(result[i].id)) continue;
      const n = result[i];
      const x = n.position?.x ?? 0;
      const y = n.position?.y ?? 0;
      result[i] = {
        ...n,
        parentId: g.id,
        extent: "parent" as const,
        position: {
          x: x - groupX,
          y: y - groupY,
        },
      };
    }
  }

  // Reorder so each group node appears before its children. React Flow expects
  // parent before children so that dragging the group moves all children.
  const topLevel = result.filter((n) => n.type !== "group" && !n.parentId);
  const groupNodes = result.filter((n) => n.type === "group");
  const childNodes = result.filter((n) => n.parentId != null);
  const ordered: Node[] = [...topLevel];
  for (const g of groups) {
    const groupNode = groupNodes.find((n) => n.id === g.id);
    if (!groupNode) continue;
    ordered.push(groupNode);
    const children = childNodes.filter((n) => n.parentId === g.id);
    ordered.push(...children);
  }
  return ordered;
}

/**
 * Fit each group's style {width, height} to its children's bounding box + padding
 * (like React Flow Selection Grouping). Children are aligned and positioned below
 * the group header.
 * @see https://reactflow.dev/examples/grouping/selection-grouping
 */
export function fitGroupBoundsAndCenterChildren(nodes: Node[]): Node[] {
  const groupIds = new Set(nodes.filter((n) => n.type === "group").map((n) => n.id));

  const result = nodes.map((node) => ({ ...node }));

  for (const groupId of groupIds) {
    const children = result.filter((n) => n.parentId === groupId);
    if (children.length === 0) continue;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const child of children) {
      const { width, height } = getNodeSize(child);
      const x = child.position?.x ?? 0;
      const y = child.position?.y ?? 0;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + width > maxX) maxX = x + width;
      if (y + height > maxY) maxY = y + height;
    }

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const groupW = contentW + 2 * GROUP_PADDING;
    const groupH = contentH + 2 * GROUP_PADDING + GROUP_HEADER_INSET;

    const centerX = (minX + maxX) / 2;
    const offsetX = groupW / 2 - centerX;
    const offsetY = GROUP_HEADER_INSET + GROUP_PADDING - minY;

    for (let i = 0; i < result.length; i++) {
      if (result[i].id === groupId) {
        result[i] = {
          ...result[i],
          style: { ...result[i].style, width: groupW, height: groupH },
        };
        break;
      }
    }
    for (let i = 0; i < result.length; i++) {
      if (result[i].parentId === groupId && result[i].position) {
        result[i] = {
          ...result[i],
          position: {
            x: result[i].position!.x + offsetX,
            y: result[i].position!.y + offsetY,
          },
        };
      }
    }
  }

  return result;
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
