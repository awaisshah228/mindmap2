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

/** ELK port side: NORTH, SOUTH, EAST, WEST */
function directionToPortSides(direction: LayoutDirection): { source: string; target: string } {
  switch (direction) {
    case "LR": return { source: "EAST", target: "WEST" };
    case "RL": return { source: "WEST", target: "EAST" };
    case "TB": return { source: "SOUTH", target: "NORTH" };
    case "BT": return { source: "NORTH", target: "SOUTH" };
    default: return { source: "EAST", target: "WEST" };
  }
}

/** Multi-handle IDs for ELK ports: right-0, right-1, left-0, etc. */
export function getMultiHandleId(base: string, index: number): string {
  return index === 0 ? base : `${base}-${index}`;
}

/**
 * ELK layout: same pattern as React Flow's official example.
 * - Graph: { id: 'root', layoutOptions, children: [{ id, width, height, ... }], edges: [{ id, sources: [id], targets: [id] }] }
 * - After layout: each node has x, y → we set position: { x: node.x, y: node.y }
 * @see https://reactflow.dev/examples/layout/elkjs
 * @see https://www.eclipse.org/elk/reference/algorithms.html
 * @see https://www.eclipse.org/elk/reference/options.html
 */
type ElkPort = { id: string; layoutOptions?: Record<string, string> };
type ElkNode = {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  layoutOptions?: Record<string, string>;
  ports?: ElkPort[];
  children?: ElkNode[];
  edges?: { id: string; sources: string[]; targets: string[] }[];
};

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
  const isDense = edges.length >= nodes.length * 1.2;
  const [nodeSpacing, layerSpacing] = isDense ? [spacing[0] * 1.15, spacing[1] * 1.2] : [spacing[0], spacing[1]];
  const layoutOptions: Record<string, string> = {
    "elk.algorithm": algorithm,
    "elk.direction": directionToElk(direction),
    "elk.spacing.nodeNode": String(nodeSpacing),
    "elk.layered.spacing.nodeNodeBetweenLayers": String(layerSpacing),
    "elk.spacing.componentComponent": String(Math.max(nodeSpacing * 2, 120)),
  };
  if (algorithm === "layered") {
    layoutOptions["elk.layered.mergeEdges"] = isDense ? "false" : "true";
    layoutOptions["elk.layered.crossingMinimization.strategy"] = "LAYER_SWEEP";
    layoutOptions["elk.layered.crossingMinimization.greedySwitch.type"] = "TWO_SIDED";
    layoutOptions["elk.layered.crossingMinimization.greedySwitch.activationThreshold"] = "0";
  }

  const { target: targetHandleId, source: sourceHandleId } = getHandleIds(direction);
  const { source: sourcePortSide, target: targetPortSide } = directionToPortSides(direction);

  const rootEdgesForElk = hasGroups
    ? edges
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          rootSource: getRootId(e.source, nodes),
          rootTarget: getRootId(e.target, nodes),
        }))
        .filter((e) => e.rootSource !== e.rootTarget)
    : edges
        .filter((e) => rootIds.has(e.source) && rootIds.has(e.target))
        .map((e) => ({ ...e, rootSource: e.source, rootTarget: e.target }));

  const useMultiHandles =
    algorithm === "layered" && isDense && rootEdgesForElk.length > 2 && !hasGroups;
  const layoutHandlesByNodeId = new Map<string, { source: number; target: number; direction: LayoutDirection }>();

  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const outIndex = new Map<string, number>();
  const inIndex = new Map<string, number>();
  for (const e of rootEdgesForElk) {
    outDegree.set(e.rootSource, (outDegree.get(e.rootSource) ?? 0) + 1);
    inDegree.set(e.rootTarget, (inDegree.get(e.rootTarget) ?? 0) + 1);
  }
  const getSourcePortId = (nid: string): string => {
    const deg = outDegree.get(nid) ?? 1;
    if (deg <= 1) return sourceHandleId;
    const idx = outIndex.get(nid) ?? 0;
    outIndex.set(nid, idx + 1);
    return getMultiHandleId(sourceHandleId, idx);
  };
  const getTargetPortId = (nid: string): string => {
    const deg = inDegree.get(nid) ?? 1;
    if (deg <= 1) return targetHandleId;
    const idx = inIndex.get(nid) ?? 0;
    inIndex.set(nid, idx + 1);
    return getMultiHandleId(targetHandleId, idx);
  };

  function buildElkNode(node: Node): ElkNode {
    const { width, height } = getNodeSize(node);
    if (node.type === "group") {
      const children = nodes.filter((n) => n.parentId === node.id);
      const childIds = new Set(children.map((c) => c.id));
      const groupEdges = edges.filter((e) => childIds.has(e.source) && childIds.has(e.target));
      const childrenElk = children.map((c) => buildElkNode(c));
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
    const base: ElkNode = { id: node.id, width, height };
    if (useMultiHandles) {
      const out = Math.max(1, outDegree.get(node.id) ?? 0);
      const inn = Math.max(1, inDegree.get(node.id) ?? 0);
      const ports: ElkPort[] = [];
      for (let i = 0; i < out; i++) {
        const pid = getMultiHandleId(sourceHandleId, i);
        ports.push({ id: pid, layoutOptions: { "org.eclipse.elk.port.side": sourcePortSide } });
      }
      for (let i = 0; i < inn; i++) {
        const pid = getMultiHandleId(targetHandleId, i);
        ports.push({ id: pid, layoutOptions: { "org.eclipse.elk.port.side": targetPortSide } });
      }
      if (ports.length > 0) {
        base.ports = ports;
        base.layoutOptions = { "org.eclipse.elk.portConstraints": "FIXED_ORDER" };
        layoutHandlesByNodeId.set(node.id, { source: out, target: inn, direction });
      }
    }
    return base;
  }

  const edgePortAssignments = new Map<string, { sourceHandle: string; targetHandle: string }>();
  const elkEdges = rootEdgesForElk.map((e, i) => {
    const srcPort = useMultiHandles ? getSourcePortId(e.rootSource) : undefined;
    const tgtPort = useMultiHandles ? getTargetPortId(e.rootTarget) : undefined;
    const src = srcPort ? `${e.rootSource}:${srcPort}` : e.rootSource;
    const tgt = tgtPort ? `${e.rootTarget}:${tgtPort}` : e.rootTarget;
    if (srcPort && tgtPort) {
      edgePortAssignments.set(e.id, { sourceHandle: srcPort, targetHandle: tgtPort });
    }
    return {
      id: e.id || `root-e${i}`,
      sources: [src],
      targets: [tgt],
      originalSource: e.source,
      originalTarget: e.target,
    };
  });

  const graph = {
    id: "root",
    layoutOptions: layoutOptions,
    children: rootNodes.map((node) => buildElkNode(node)),
    edges: elkEdges.map(({ id, sources, targets }) => ({ id, sources, targets })),
  };

  const layoutedGraph = (await elk.layout(graph)) as { children?: ElkNode[] };
  const byId = new Map<string, Node>();

  function applyElkLayout(elkNode: ElkNode): void {
    const node = nodeById.get(elkNode.id);
    if (!node) return;
    const x = elkNode.x ?? 0;
    const y = elkNode.y ?? 0;
    const lh = layoutHandlesByNodeId.get(elkNode.id);
    byId.set(elkNode.id, {
      ...node,
      targetPosition: targetPos,
      sourcePosition: sourcePos,
      position: { x, y },
      data: lh ? { ...node.data, layoutHandles: { source: lh.source, target: lh.target }, layoutDirection: lh.direction } : node.data,
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

  const layoutedIds = new Set(nodes.map((n) => n.id));
  let resultEdges: Edge[];
  if (useMultiHandles && edgePortAssignments.size > 0) {
    resultEdges = edges.map((e) => {
      const assigns = edgePortAssignments.get(e.id);
      if (assigns && layoutedIds.has(e.source) && layoutedIds.has(e.target)) {
        return { ...e, sourceHandle: assigns.sourceHandle, targetHandle: assigns.targetHandle };
      }
      return normalizeEdgeHandlesForDirection(layoutedIds, [e], direction)[0] ?? e;
    });
  } else {
    resultEdges = normalizeEdgeHandlesForDirection(layoutedIds, edges, direction);
  }
  return { nodes: allNodes, edges: resultEdges };
}

const GROUP_PADDING = 100;
const GROUP_HEADER_INSET = 48;
const CHILD_PADDING = 40;

export type GroupMetadata = { id: string; label: string; nodeIds: string[] };

/**
 * Layout children inside each group with proper spacing and padding.
 * Ensures extent: "parent" on all grouped children so they cannot be dragged outside.
 */
export async function layoutChildrenInsideGroups(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = "LR",
  spacing: LayoutSpacing = [40, 32]
): Promise<Node[]> {
  const groupIds = new Set(nodes.filter((n) => n.type === "group").map((n) => n.id));
  if (groupIds.size === 0) return nodes;

  let result = nodes.map((n) => ({ ...n }));

  for (const groupId of groupIds) {
    const children = result.filter((n) => n.parentId === groupId);
    if (children.length === 0) continue;

    const childIds = new Set(children.map((c) => c.id));
    const childEdges = edges.filter(
      (e) => childIds.has(e.source) && childIds.has(e.target)
    );

    let layoutedChildren: Node[];
    if (children.length >= 2 || childEdges.length > 0) {
      const childrenAsRoot = children.map((c) => ({ ...c, parentId: undefined }));
      const { nodes: laid } = await getLayoutedElements(
        childrenAsRoot,
        childEdges,
        direction,
        spacing,
        "elk-layered"
      );
      layoutedChildren = laid;
    } else {
      layoutedChildren = children;
    }

    let minX = Infinity;
    let minY = Infinity;
    for (const c of layoutedChildren) {
      const x = c.position?.x ?? 0;
      const y = c.position?.y ?? 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
    }

    const offsetX = CHILD_PADDING - minX;
    const offsetY = GROUP_HEADER_INSET + CHILD_PADDING - minY;

    for (let i = 0; i < result.length; i++) {
      if (result[i].parentId !== groupId) continue;
      const laid = layoutedChildren.find((c) => c.id === result[i].id);
      if (!laid) continue;
      result[i] = {
        ...result[i],
        extent: "parent" as const,
        position: {
          x: (laid.position?.x ?? 0) + offsetX,
          y: (laid.position?.y ?? 0) + offsetY,
        },
      };
    }
  }

  result = fitGroupBoundsAndCenterChildren(result);
  return ensureExtentForGroupedNodes(result);
}

/**
 * Ensure every node with parentId has extent: "parent" so it cannot be dragged outside the group.
 */
export function ensureExtentForGroupedNodes(nodes: Node[]): Node[] {
  return nodes.map((n) =>
    n.parentId ? { ...n, extent: "parent" as const } : n
  );
}

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

    const contentW = Math.max(0, maxX - minX);
    const contentH = Math.max(0, maxY - minY);
    const groupW = Math.max(GROUP_NODE_DEFAULT_WIDTH, contentW + 2 * GROUP_PADDING);
    const groupH = Math.max(GROUP_NODE_DEFAULT_HEIGHT, contentH + 2 * GROUP_PADDING + GROUP_HEADER_INSET);
    const groupX = minX - GROUP_PADDING;
    const groupY = minY - GROUP_HEADER_INSET - GROUP_PADDING;

    const groupNode: Node = {
      id: g.id,
      type: "group",
      position: { x: groupX, y: groupY },
      data: { label: g.label ?? g.id },
      width: groupW,
      height: groupH,
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
 * Fit each group's width and height to its children's bounding box + padding.
 * Group dimensions scale automatically so there is always space around the content
 * (top, bottom, left, right). Children are centered within the padded area.
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

    const contentW = Math.max(0, maxX - minX);
    const contentH = Math.max(0, maxY - minY);
    const groupW = Math.max(GROUP_NODE_DEFAULT_WIDTH, contentW + 2 * GROUP_PADDING);
    const groupH = Math.max(GROUP_NODE_DEFAULT_HEIGHT, contentH + 2 * GROUP_PADDING + GROUP_HEADER_INSET);

    const centerX = (minX + maxX) / 2;
    const offsetX = groupW / 2 - centerX;
    const offsetY = GROUP_HEADER_INSET + GROUP_PADDING - minY;

    for (let i = 0; i < result.length; i++) {
      if (result[i].id === groupId) {
        const groupNode = result[i];
        result[i] = {
          ...groupNode,
          width: groupW,
          height: groupH,
          style: { ...(groupNode.style as object), width: groupW, height: groupH },
        };
        break;
      }
    }
    for (let i = 0; i < result.length; i++) {
      if (result[i].parentId === groupId && result[i].position) {
        result[i] = {
          ...result[i],
          extent: "parent" as const,
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

/**
 * Resize each group to fit its children without moving children.
 * Use when a child is dragged — parent expands to contain all children.
 * Unlike fitGroupBoundsAndCenterChildren, this does NOT reposition children.
 */
export function resizeGroupToFitChildren(nodes: Node[]): Node[] {
  const groupIds = new Set(nodes.filter((n) => n.type === "group").map((n) => n.id));
  if (groupIds.size === 0) return nodes;

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

    const contentW = Math.max(0, maxX - minX);
    const contentH = Math.max(0, maxY - minY);
    const groupW = Math.max(GROUP_NODE_DEFAULT_WIDTH, contentW + 2 * GROUP_PADDING);
    const groupH = Math.max(GROUP_NODE_DEFAULT_HEIGHT, contentH + 2 * GROUP_PADDING + GROUP_HEADER_INSET);

    for (let i = 0; i < result.length; i++) {
      if (result[i].id === groupId) {
        const groupNode = result[i];
        result[i] = {
          ...groupNode,
          width: groupW,
          height: groupH,
          style: { ...(groupNode.style as object), width: groupW, height: groupH },
        };
        break;
      }
    }
  }

  return result;
}

/** Shift all nodes left so the leftmost node is at padding (root pulled back on x-axis). */
function shiftLayoutLeft(nodes: Node[], leftPadding: number): Node[] {
  if (nodes.length === 0) return nodes;
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const dx = minX - leftPadding;
  if (Math.abs(dx) < 1) return nodes;
  return nodes.map((n) => ({
    ...n,
    position: { x: n.position.x - dx, y: n.position.y },
  }));
}

/** Normalize edge handle IDs to match layout direction for proper connector routing. */
export function normalizeEdgeHandlesForDirection(
  layoutedNodeIds: Set<string>,
  edges: Edge[],
  direction: LayoutDirection
): Edge[] {
  const { target: targetId, source: sourceId } = getHandleIds(direction);
  return edges.map((e) => {
    const inLayout = layoutedNodeIds.has(e.source) || layoutedNodeIds.has(e.target);
    return inLayout ? { ...e, sourceHandle: sourceId, targetHandle: targetId } : e;
  });
}

/** @deprecated Use normalizeEdgeHandlesForDirection with layouted node ids. */
export function normalizeMindMapEdgeHandles(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection
): Edge[] {
  const ids = new Set(nodes.filter((n) => n.type === "mindMap").map((n) => n.id));
  return normalizeEdgeHandlesForDirection(ids, edges, direction);
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
    const layoutableIds = new Set(nodes.map((n) => n.id));
    const layoutedNodes = nodes.map((node) => ({
      ...node,
      targetPosition: targetPos,
      sourcePosition: sourcePos,
    }));
    return { nodes: layoutedNodes, edges: normalizeEdgeHandlesForDirection(layoutableIds, edges, direction) };
  }

  const layoutableIds = new Set(nodes.map((n) => n.id));
  const layoutableEdges = edges.filter((e) => layoutableIds.has(e.source) && layoutableIds.has(e.target));
  const dagreGraph = new Graph().setDefaultEdgeLabel(() => ({}));

  const { target: targetPos, source: sourcePos } = getHandlePositions(direction);
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: spacing[0],
    ranksep: spacing[1],
  });

  nodes.forEach((node) => {
    const { width, height } = getNodeSize(node);
    dagreGraph.setNode(node.id, { width, height });
  });

  layoutableEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  layoutFn(dagreGraph);

  const layoutedNodes: Node[] = nodes.map((node) => {
    const { width, height } = getNodeSize(node);
    const nodeWithPosition = dagreGraph.node(node.id);
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
  const normalizedEdges = normalizeEdgeHandlesForDirection(layoutableIds, edges, direction);
  return { nodes: shifted, edges: normalizedEdges };
}

const VIRTUAL_ROOT_ID = "__layout_root__";

async function layoutWithD3Hierarchy(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection,
  spacing: LayoutSpacing,
  variant: "tree" | "cluster"
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const d3 = await import("d3-hierarchy");
  const roots = nodes.filter((n) => !edges.some((e) => e.target === n.id));
  if (roots.length === 0) return { nodes, edges };

  const layoutableIds = new Set(nodes.map((n) => n.id));
  const data: { id: string; parentId: string | null }[] = nodes.map((n) => {
    const incoming = edges.find((e) => e.target === n.id);
    const parentId = incoming ? incoming.source : null;
    return { id: n.id, parentId };
  });

  if (roots.length > 1) {
    data.push({ id: VIRTUAL_ROOT_ID, parentId: null });
    for (const r of roots) {
      const idx = data.findIndex((d) => d.id === r.id);
      if (idx >= 0) data[idx].parentId = VIRTUAL_ROOT_ID;
    }
  }

  const root = d3.stratify<{ id: string; parentId: string | null }>()
    .id((d) => d.id)
    .parentId((d) => d.parentId)(data);

  const [nodeW, nodeH] = spacing;
  const rootAsUnknown = root as import("d3-hierarchy").HierarchyNode<unknown>;
  const layoutRoot =
    variant === "cluster"
      ? d3.cluster().nodeSize([nodeW, nodeH])(rootAsUnknown)
      : d3.tree().nodeSize([nodeW, nodeH])(rootAsUnknown);

  const { target: targetPos, source: sourcePos } = getHandlePositions(direction);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const layoutedNodes: Node[] = layoutRoot
    .descendants()
    .filter((d) => (d.data as { id: string }).id !== VIRTUAL_ROOT_ID)
    .flatMap((d) => {
      const node = nodeMap.get((d.data as { id: string }).id);
      if (!node) return [];
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
      return [
        {
          ...node,
          targetPosition: targetPos,
          sourcePosition: sourcePos,
          position: { x, y },
        },
      ];
    });

  const shifted = shiftLayoutLeft(layoutedNodes, ROOT_LEFT_PADDING);
  const normalizedEdges = normalizeEdgeHandlesForDirection(layoutableIds, edges, direction);
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

export type AutoLayoutOptions = {
  algorithm: LayoutAlgorithm;
  direction: LayoutDirection;
  spacing: LayoutSpacing;
};

/**
 * Detects if the graph contains cycles (for layout algorithm selection).
 */
function hasCycle(nodeIds: Set<string>, edges: Edge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    const list = adj.get(e.source) ?? [];
    list.push(e.target);
    adj.set(e.source, list);
  }
  const visited = new Set<string>();
  const stack = new Set<string>();
  const visit = (id: string): boolean => {
    visited.add(id);
    stack.add(id);
    for (const to of adj.get(id) ?? []) {
      if (!visited.has(to)) {
        if (visit(to)) return true;
      } else if (stack.has(to)) return true;
    }
    stack.delete(id);
    return false;
  };
  for (const id of nodeIds) {
    if (!visited.has(id) && visit(id)) return true;
  }
  return false;
}

/**
 * Analyzes the graph and returns the best layout algorithm and direction.
 * Use for auto-layout to get optimal results without user configuration.
 */
export function chooseBestLayoutOptions(
  nodes: Node[],
  edges: Edge[],
  nodeIds?: Set<string>
): AutoLayoutOptions {
  const ids = nodeIds ?? new Set(nodes.map((n) => n.id));
  const relevantEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));

  const roots = nodes.filter((n) => ids.has(n.id) && !relevantEdges.some((e) => e.target === n.id));
  const rootCount = roots.length;
  const hasGroups = nodes.some((n) => ids.has(n.id) && n.type === "group");
  const cyclic = hasCycle(ids, relevantEdges);
  const nodeCount = ids.size;

  let algorithm: LayoutAlgorithm;
  if (cyclic || nodeCount > 50) {
    algorithm = "elk-force";
  } else if (hasGroups) {
    algorithm = "elk-layered";
  } else if (rootCount === 1 && !cyclic) {
    algorithm = "elk-layered";
  } else if (rootCount > 1 && !cyclic) {
    algorithm = "elk-layered";
  } else {
    algorithm = "elk-layered";
  }

  const direction: LayoutDirection = "LR";
  const spacing: LayoutSpacing = [80, 60];

  return { algorithm, direction, spacing };
}

/** Minimum gap between nodes after collision resolution (px). */
const COLLISION_PADDING = 16;

/**
 * Resolves overlapping nodes by nudging them apart.
 * Only used during AI diagram generation; no persistent state.
 * Processes root-level nodes and siblings within groups separately.
 */
export function resolveNodeCollisions(nodes: Node[], padding = COLLISION_PADDING): Node[] {
  if (nodes.length < 2) return nodes;

  const byParent = new Map<string | null, Node[]>();
  for (const n of nodes) {
    const key = n.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }

  const result = nodes.map((n) => ({ ...n, position: { ...n.position } }));

  for (const group of byParent.values()) {
    if (group.length < 2) continue;

    for (let iter = 0; iter < 12; iter++) {
      let moved = false;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = result.find((n) => n.id === group[i].id)!;
          const b = result.find((n) => n.id === group[j].id)!;
          const sizeA = getNodeSize(a);
          const sizeB = getNodeSize(b);
          const ax = a.position.x ?? 0;
          const ay = a.position.y ?? 0;
          const bx = b.position.x ?? 0;
          const by = b.position.y ?? 0;

          const aRight = ax + sizeA.width;
          const aBottom = ay + sizeA.height;
          const bRight = bx + sizeB.width;
          const bBottom = by + sizeB.height;

          const overlapX = Math.min(aRight, bRight) - Math.max(ax, bx);
          const overlapY = Math.min(aBottom, bBottom) - Math.max(ay, by);
          const pushX = overlapX > -padding ? (padding + overlapX) / 2 : 0;
          const pushY = overlapY > -padding ? (padding + overlapY) / 2 : 0;
          if (pushX <= 0 && pushY <= 0) continue;

          const dx = pushX * (ax < bx ? -1 : 1);
          const dy = pushY * (ay < by ? -1 : 1);

          a.position.x = ax + dx;
          a.position.y = ay + dy;
          b.position.x = bx - dx;
          b.position.y = by - dy;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  return result;
}

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
