/**
 * Branch colors for mind map edges and nodes.
 * Edges use stroke colors; nodes use matching light backgrounds.
 */
export const BRANCH_STROKE_COLORS = [
  "rgb(59 130 246)",   // blue
  "rgb(34 197 94)",    // green
  "rgb(234 179 8)",    // amber
  "rgb(249 115 22)",   // orange
  "rgb(236 72 153)",   // pink
  "rgb(139 92 246)",   // violet
  "rgb(20 184 166)",   // teal
  "rgb(239 68 68)",    // red
  "rgb(99 102 241)",   // indigo
  "rgb(168 85 247)",   // purple
];

export const BRANCH_BG_COLORS = [
  "rgb(219 234 254)",  // light blue
  "rgb(220 252 231)",  // light green
  "rgb(254 249 195)",  // light yellow
  "rgb(255 237 213)",  // light orange
  "rgb(252 231 243)",  // light pink
  "rgb(237 233 254)",  // light violet
  "rgb(204 251 241)",  // light teal
  "rgb(254 226 226)",  // light red
  "rgb(224 231 255)",  // light indigo
  "rgb(250 245 255)",  // light purple
];

export const BRANCH_TEXT_COLORS = [
  "rgb(30 64 175)",    // dark blue
  "rgb(22 101 52)",    // dark green
  "rgb(161 98 7)",     // dark amber
  "rgb(154 52 18)",    // dark orange
  "rgb(157 23 77)",    // dark pink
  "rgb(91 33 182)",    // dark violet
  "rgb(19 78 74)",     // dark teal
  "rgb(153 27 27)",    // dark red
  "rgb(49 46 129)",    // dark indigo
  "rgb(88 28 135)",    // dark purple
];

/**
 * Walk up the parent chain using the parentMap, stopping if a cycle is
 * detected (visited set) to prevent infinite loops in cyclic graphs.
 */
function walkToRoot(startId: string, parentMap: Map<string, string>): string[] {
  const path: string[] = [startId];
  const visited = new Set<string>([startId]);
  let current = startId;
  while (parentMap.has(current)) {
    const parent = parentMap.get(current)!;
    if (visited.has(parent)) break; // cycle detected — stop
    visited.add(parent);
    current = parent;
    path.unshift(current);
  }
  return path;
}

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function getBranchIndex(nodeId: string, edges: { source: string; target: string }[]): number {
  const parentMap = new Map<string, string>();
  edges.forEach((e) => parentMap.set(e.target, e.source));

  const path = walkToRoot(nodeId, parentMap);
  const branchId = path.length >= 2 ? path[1] : nodeId;
  return Math.abs(hashString(branchId)) % BRANCH_STROKE_COLORS.length;
}

export function getBranchStrokeColor(
  source: string,
  target: string,
  edges: { source: string; target: string }[]
): string {
  const parentMap = new Map<string, string>();
  edges.forEach((e) => parentMap.set(e.target, e.source));

  const path = walkToRoot(source, parentMap);
  const branchId = path.length >= 2 ? path[1] : target;
  const idx = Math.abs(hashString(branchId)) % BRANCH_STROKE_COLORS.length;
  return BRANCH_STROKE_COLORS[idx];
}

export function getNodeBranchStyle(
  nodeId: string,
  edges: { source: string; target: string }[],
  overrideColor?: string | null
): { bg: string; text: string; stroke: string } {
  if (overrideColor && overrideColor.trim()) {
    return { bg: overrideColor, text: "rgb(30 41 59)", stroke: "rgb(100 116 139)" };
  }
  const idx = getBranchIndex(nodeId, edges);
  return {
    bg: BRANCH_BG_COLORS[idx],
    text: BRANCH_TEXT_COLORS[idx],
    stroke: BRANCH_STROKE_COLORS[idx],
  };
}

export const PALETTE_COLORS = BRANCH_BG_COLORS;
