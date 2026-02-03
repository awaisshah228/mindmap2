import type { Node } from "@xyflow/react";

const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 50;
const MIND_MAP_NODE_WIDTH = 170;
const MIND_MAP_NODE_HEIGHT = 44;

export interface ResolveCollisionsOptions {
  maxIterations?: number;
  overlapThreshold?: number;
  margin?: number;
}

function getNodeSize(node: Node): { width: number; height: number } {
  const defW = node.type === "mindMap" ? MIND_MAP_NODE_WIDTH : DEFAULT_NODE_WIDTH;
  const defH = node.type === "mindMap" ? MIND_MAP_NODE_HEIGHT : DEFAULT_NODE_HEIGHT;
  const w = node.measured?.width ?? node.width ?? defW;
  const h = node.measured?.height ?? node.height ?? defH;
  return { width: Number(w) || defW, height: Number(h) || defH };
}

/**
 * Resolves node overlaps by pushing overlapping nodes apart.
 * Based on the naive O(n²) algorithm from React Flow's node-collisions example
 * and xyflow/node-collision-algorithms.
 * @see https://reactflow.dev/examples/layout/node-collisions
 * @see https://github.com/xyflow/node-collision-algorithms
 */
export function resolveCollisions(
  nodes: Node[],
  options: ResolveCollisionsOptions = {}
): Node[] {
  const {
    maxIterations = 50,
    overlapThreshold = 0.5,
    margin = 15,
  } = options;

  if (nodes.length < 2) return nodes;

  const boxes = nodes.map((node) => {
    const { width, height } = getNodeSize(node);
    return {
      x: node.position.x - margin,
      y: node.position.y - margin,
      width: width + margin * 2,
      height: height + margin * 2,
      node,
      moved: false,
    };
  });

  for (let iter = 0; iter < maxIterations; iter++) {
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
