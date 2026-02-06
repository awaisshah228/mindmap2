/**
 * Convert Excalidraw skeleton elements to Draw.io mxGraph XML.
 * Maps rectangle, diamond, ellipse, text, arrow to mxCell elements.
 */

type ExcalidrawSkeleton = {
  type: string;
  id?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  label?: { text?: string };
  backgroundColor?: string;
  strokeColor?: string;
  groupId?: string;
  start?: { id?: string };
  end?: { id?: string };
  /** 0–1: where arrow leaves source. 1,0.5=right, 0,0.5=left, 0.5,1=bottom, 0.5,0=top */
  exitX?: number;
  exitY?: number;
  /** 0–1: where arrow enters target */
  entryX?: number;
  entryY?: number;
};

function nextId(): string {
  return `mx-${Math.random().toString(36).slice(2, 9)}`;
}

function ensureId(s: string | undefined, fallback: string): string {
  if (s && /^[a-zA-Z0-9_-]+$/.test(s)) return s;
  return fallback;
}

function clamp01(n: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

export function excalidrawToDrawioXml(
  skeletons: ExcalidrawSkeleton[]
): string {
  const idMap = new Map<string, string>();
  const shapes: ExcalidrawSkeleton[] = [];
  const arrows: ExcalidrawSkeleton[] = [];
  for (const el of skeletons) {
    const t = (el.type || "").toLowerCase();
    if (t === "arrow" || t === "line") arrows.push(el);
    else shapes.push(el);
  }

  const cells: string[] = [];
  cells.push('<mxCell id="0" />');
  cells.push('<mxCell id="1" parent="0" />');

  for (const s of shapes) {
    const id = ensureId(s.id, nextId());
    idMap.set(s.id || id, id);
    const w = Math.max(Number(s.width) || 120, 40);
    const h = Math.max(Number(s.height) || 40, 24);
    const label = (s.label?.text ?? s.text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const bg = s.backgroundColor || "#e7f5ff";
    const stroke = s.strokeColor || "#1971c2";
    const style = getShapeStyle(s.type, bg, stroke);
    cells.push(`<mxCell id="${id}" value="${label}" style="${style}" vertex="1" parent="1"><mxGeometry x="${s.x}" y="${s.y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
  }

  for (const a of arrows) {
    const aid = ensureId(a.id, nextId());
    const startId = a.start?.id ? (idMap.get(a.start.id) || idMap.get(`ex-${a.start.id}`) || a.start.id) : "";
    const endId = a.end?.id ? (idMap.get(a.end.id) || idMap.get(`ex-${a.end.id}`) || a.end.id) : "";
    if (!startId || !endId) continue;
    const label = (a.label?.text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    // Connection points: 0–1. Default right→left for left-to-right flow.
    const exitX = clamp01(a.exitX ?? 1);
    const exitY = clamp01(a.exitY ?? 0.5);
    const entryX = clamp01(a.entryX ?? 0);
    const entryY = clamp01(a.entryY ?? 0.5);
    // Rounded corners; explicit connection points for clean attachment
    const edgeStyle = `endArrow=classic;html=1;rounded=1;exitX=${exitX};exitY=${exitY};entryX=${entryX};entryY=${entryY};`;
    cells.push(`<mxCell id="${aid}" value="${label}" style="${edgeStyle}" edge="1" parent="1" source="${startId}" target="${endId}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net">
  <diagram name="Diagram" id="${nextId()}">
    <mxGraphModel dx="1434" dy="780" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

function getShapeStyle(type: string, bg: string, stroke: string): string {
  const base = `rounded=0;whiteSpace=wrap;html=1;fillColor=${bg};strokeColor=${stroke};`;
  const t = type.toLowerCase();
  if (t === "diamond") return `rhombus;${base}`;
  if (t === "ellipse" || t === "circle") return `ellipse;${base}`;
  if (t === "text") return `text;html=1;align=left;verticalAlign=top;fillColor=${bg};strokeColor=${stroke};`;
  return base;
}
