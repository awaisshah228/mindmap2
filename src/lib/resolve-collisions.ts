import type { Node } from "@xyflow/react";

const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 50;
const MIND_MAP_NODE_WIDTH = 170;
const MIND_MAP_NODE_HEIGHT = 44;
const GROUP_NODE_DEFAULT_WIDTH = 280;
const GROUP_NODE_DEFAULT_HEIGHT = 200;

/** Default [width, height] per node type when node has no measured/size (e.g. AI nodes before first render). */
const TYPE_DEFAULTS: Record<string, [number, number]> = {
  mindMap: [MIND_MAP_NODE_WIDTH, MIND_MAP_NODE_HEIGHT],
  group: [GROUP_NODE_DEFAULT_WIDTH, GROUP_NODE_DEFAULT_HEIGHT],
  icon: [64, 64],
  service: [180, 56],
  queue: [140, 50],
  actor: [100, 60],
  databaseSchema: [200, 100],
  rectangle: [160, 60],
  diamond: [120, 80],
  circle: [80, 80],
  document: [140, 70],
  stickyNote: [160, 120],
  text: [120, 40],
  image: [200, 150],
};

export type CollisionAlgorithmOptions = {
  maxIterations: number;
  overlapThreshold: number;
  margin: number;
};

export type CollisionAlgorithm = (
  nodes: Node[],
  options: CollisionAlgorithmOptions
) => Node[];

export interface ResolveCollisionsOptions {
  maxIterations?: number;
  overlapThreshold?: number;
  margin?: number;
}

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  moved: boolean;
  node: Node;
};

function getNodeSize(node: Node): { width: number; height: number } {
  const typeDefaults = TYPE_DEFAULTS[node.type ?? ""];
  const defW = typeDefaults?.[0] ?? DEFAULT_NODE_WIDTH;
  const defH = typeDefaults?.[1] ?? DEFAULT_NODE_HEIGHT;
  if (node.type === "group") {
    const style = node.style as { width?: number; height?: number } | undefined;
    if (style?.width != null || style?.height != null) {
      return {
        width: Number(style?.width) || defW,
        height: Number(style?.height) || defH,
      };
    }
  }
  const w = node.width ?? node.measured?.width;
  const h = node.height ?? node.measured?.height;
  return {
    width: typeof w === "number" && w > 0 ? w : defW,
    height: typeof h === "number" && h > 0 ? h : defH,
  };
}

/**
 * Build collision boxes from nodes (same pattern as React Flow node-collisions example).
 * Uses type-based defaults when width/height are missing or 0 (e.g. before first render).
 * @see https://reactflow.dev/examples/layout/node-collisions
 */
function getBoxesFromNodes(nodes: Node[], margin = 0): Box[] {
  const boxes: Box[] = new Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const { width, height } = getNodeSize(node);
    boxes[i] = {
      x: node.position.x - margin,
      y: node.position.y - margin,
      width: width + margin * 2,
      height: height + margin * 2,
      node,
      moved: false,
    };
  }
  return boxes;
}

/**
 * Resolves node overlaps by pushing overlapping nodes apart.
 * Matches the algorithm from React Flow's node-collisions example; resolves along
 * the axis with smallest overlap so related nodes stay closer.
 * @see https://reactflow.dev/examples/layout/node-collisions
 */
export function resolveCollisions(
  nodes: Node[],
  options: ResolveCollisionsOptions | CollisionAlgorithmOptions = {}
): Node[] {
  const maxIterations = options.maxIterations ?? 50;
  const overlapThreshold = options.overlapThreshold ?? 0.5;
  const margin = options.margin ?? 0;

  if (nodes.length < 2) return nodes;

  const boxes = getBoxesFromNodes(nodes, margin);

  for (let iter = 0; iter <= maxIterations; iter++) {
    let moved = false;

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i];
        const B = boxes[j];

        const centerAX = A.x + A.width * 0.5;
        const centerAY = A.y + A.height * 0.5;
        const centerBX = B.x + B.width * 0.5;
        const centerBY = B.y + B.height * 0.5;

        const dx = centerAX - centerBX;
        const dy = centerAY - centerBY;

        const px = (A.width + B.width) * 0.5 - Math.abs(dx);
        const py = (A.height + B.height) * 0.5 - Math.abs(dy);

        if (px > overlapThreshold && py > overlapThreshold) {
          A.moved = B.moved = moved = true;
          if (px < py) {
            const sx = dx > 0 ? 1 : -1;
            const moveAmount = (px / 2) * sx;
            A.x += moveAmount;
            B.x -= moveAmount;
          } else {
            const sy = dy > 0 ? 1 : -1;
            const moveAmount = (py / 2) * sy;
            A.y += moveAmount;
            B.y -= moveAmount;
          }
        }
      }
    }

    if (!moved) break;
  }

  return boxes.map((box) =>
    box.moved
      ? {
          ...box.node,
          position: {
            x: box.x + margin,
            y: box.y + margin,
          },
        }
      : box.node
  );
}

/**
 * Resolve collisions for all nodes including groups: first resolve root-level nodes
 * (so groups and top-level nodes don't overlap), then resolve children within each group.
 * Use after layout (e.g. AI diagram) so no nodes or groups overlap. Preserves node order.
 * @see https://reactflow.dev/examples/layout/node-collisions
 */
export function resolveCollisionsWithGroups(
  nodes: Node[],
  options: ResolveCollisionsOptions = {}
): Node[] {
  if (nodes.length < 2) return nodes;

  const roots = nodes.filter((n) => !n.parentId);
  const resolvedRoots = resolveCollisions(roots, {
    maxIterations: Number.POSITIVE_INFINITY,
    overlapThreshold: 0.5,
    margin: 24,
    ...options,
  });

  const byParentId = new Map<string, Node[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const list = byParentId.get(n.parentId) ?? [];
      list.push(n);
      byParentId.set(n.parentId, list);
    }
  }

  const resolvedChildren: Node[] = [];
  for (const group of resolvedRoots) {
    if (group.type !== "group") continue;
    const children = byParentId.get(group.id);
    if (!children?.length) continue;

    const groupPos = group.position;
    const toAbsolute = (node: Node): Node => ({
      ...node,
      position: {
        x: (node.position?.x ?? 0) + groupPos.x,
        y: (node.position?.y ?? 0) + groupPos.y,
      },
    });
    const toRelative = (node: Node): Node => ({
      ...node,
      position: {
        x: (node.position?.x ?? 0) - groupPos.x,
        y: (node.position?.y ?? 0) - groupPos.y,
      },
    });

    const absoluteChildren = children.map(toAbsolute);
    const resolvedAbsolute = resolveCollisions(absoluteChildren, { margin: 16, ...options });
    resolvedChildren.push(...resolvedAbsolute.map(toRelative));
  }

  return [...resolvedRoots, ...resolvedChildren];
}
