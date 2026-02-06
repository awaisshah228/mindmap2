/**
 * Parse Draw.io mxGraph XML and convert to React Flow nodes + edges.
 * Handles vertex cells (shapes) and edge cells.
 * Skips embedded images (shape=image) to avoid raster blobs — use structural conversion instead.
 */
import type { Node, Edge } from "@xyflow/react";

interface ParsedCell {
  id: string;
  value: string;
  style: Record<string, string>;
  vertex?: boolean;
  edge?: boolean;
  parent?: string;
  source?: string;
  target?: string;
  geometry?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
}

function parseStyle(styleStr: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!styleStr || typeof styleStr !== "string") return out;
  for (const part of styleStr.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      if (k && v) out[k] = v;
    } else if (part.trim()) {
      // Standalone tokens like "rhombus", "ellipse" (Draw.io shape hints)
      out[part.trim()] = "1";
    }
  }
  return out;
}

function parseXml(xml: string): ParsedCell[] {
  if (typeof window === "undefined") return [];
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const cells: ParsedCell[] = [];
    const mxCells = doc.getElementsByTagName("mxCell");
    for (let i = 0; i < mxCells.length; i++) {
      const c = mxCells[i];
      const id = c.getAttribute("id") ?? `cell-${i}`;
      const value = (c.getAttribute("value") ?? "").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      const style = parseStyle(c.getAttribute("style") ?? "");
      const vertex = c.getAttribute("vertex") === "1";
      const edge = c.getAttribute("edge") === "1";
      const parent = c.getAttribute("parent") ?? undefined;
      const source = c.getAttribute("source") ?? undefined;
      const target = c.getAttribute("target") ?? undefined;

      let geometry: ParsedCell["geometry"];
      const geom = c.getElementsByTagName("mxGeometry")[0];
      if (geom) {
        const x = parseFloat(geom.getAttribute("x") ?? "0");
        const y = parseFloat(geom.getAttribute("y") ?? "0");
        const w = parseFloat(geom.getAttribute("width") ?? "120");
        const h = parseFloat(geom.getAttribute("height") ?? "40");
        geometry = { x, y, width: w, height: h };
      }

      cells.push({
        id,
        value,
        style,
        vertex: vertex || false,
        edge: edge || false,
        parent,
        source,
        target,
        geometry,
      });
    }
    return cells;
  } catch {
    return [];
  }
}

/** Map Draw.io shape style to React Flow node type. */
function styleToNodeType(style: Record<string, string>): string {
  const shape = (style.shape ?? "").toLowerCase();
  if (shape === "rhombus" || style.rhombus) return "diamond";
  if (shape === "ellipse" || style.ellipse) return "circle";
  if (shape === "text" || shape.includes("text")) return "text";
  return "rectangle";
}

/**
 * Convert Draw.io mxGraph XML to React Flow nodes and edges.
 * Skips:
 * - Root/placeholder cells (id 0, 1)
 * - Embedded images (shape=image) — these cause export issues; prefer structural conversion
 */
export function drawioXmlToDiagram(xml: string): { nodes: Node[]; edges: Edge[] } {
  const cells = parseXml(xml);
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const idMap = new Map<string, string>();

  const rootIds = new Set<string>(["0", "1"]);

  for (const c of cells) {
    if (rootIds.has(c.id)) continue;
    if (c.style.shape === "image") continue; // Skip embedded images — not editable, causes export issues
    if (!c.vertex && !c.edge) continue;

    if (c.vertex && c.geometry) {
      const rfId = `node-${c.id}`;
      idMap.set(c.id, rfId);
      const type = styleToNodeType(c.style);
      const x = c.geometry.x ?? 0;
      const y = c.geometry.y ?? 0;
      const w = Math.max(c.geometry.width ?? 120, 40);
      const h = Math.max(c.geometry.height ?? 40, 24);
      const fillColor = c.style.fillColor ?? "#e7f5ff";
      const strokeColor = c.style.strokeColor ?? "#1971c2";

      nodes.push({
        id: rfId,
        type,
        position: { x, y },
        data: {
          label: c.value || "Untitled",
          backgroundColor: fillColor,
          ...(strokeColor && { strokeColor }),
        },
        width: w,
        height: h,
      });
    }
  }

  for (const c of cells) {
    if (!c.edge || !c.source || !c.target) continue;
    const srcId = idMap.get(c.source) ?? c.source;
    const tgtId = idMap.get(c.target) ?? c.target;
    if (!nodes.some((n) => n.id === srcId) || !nodes.some((n) => n.id === tgtId)) continue;

    const label = (c.value ?? "").trim();
    edges.push({
      id: `e-${srcId}-${tgtId}-${edges.length}`,
      source: srcId,
      target: tgtId,
      data: label ? { label } : {},
    });
  }

  return { nodes, edges };
}
