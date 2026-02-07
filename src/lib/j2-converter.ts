/**
 * J2 DSL → Excalidraw conversion engine.
 * Converts compact DSL (rect, ellipse, w/h, startBind/endBind) to full Excalidraw elements.
 * Based on Excalidraw AI project converter.
 */

type Point = [number, number];
type ColorShorthand = "k" | "w" | "r" | "g" | "b" | "y" | "p" | "o" | "t";

interface BaseDSL {
  id: string;
  type: string;
  x: number;
  y: number;
  stroke?: ColorShorthand | string;
  fill?: ColorShorthand | string;
  strokeW?: number;
  text?: string;
  fontSize?: number;
}

interface DSLShape extends BaseDSL {
  type: "rect" | "ellipse" | "diamond";
  w: number;
  h: number;
}

interface DSLArrow extends BaseDSL {
  type: "arrow";
  endX: number;
  endY: number;
  startBind?: string;
  endBind?: string;
}

interface DSLText extends BaseDSL {
  type: "text";
  text: string;
  container?: string;
}

type DSLElement = DSLShape | DSLArrow | DSLText | BaseDSL & Record<string, unknown>;

const COLORS: Record<ColorShorthand, string> = {
  k: "#1e1e1e",
  w: "#ffffff",
  r: "#e03131",
  g: "#2f9e44",
  b: "#1971c2",
  y: "#f59f00",
  p: "#9c36b5",
  o: "#fd7e14",
  t: "transparent",
};

const TYPE_MAP: Record<string, string> = {
  rect: "rectangle",
  ellipse: "ellipse",
  diamond: "diamond",
  arrow: "arrow",
  line: "line",
  freedraw: "freedraw",
  text: "text",
};

function resolveColor(ref?: ColorShorthand | string): string {
  if (!ref) return "#1e1e1e";
  return COLORS[ref as ColorShorthand] ?? (ref as string);
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

/** Convert J2 DSL elements to full Excalidraw elements for rendering. */
export function dslToExcalidraw(dslElements: DSLElement[] | Record<string, unknown>[]): unknown[] {
  const elements = dslElements as DSLElement[];
  const result: Record<string, unknown>[] = [];
  const idMap = new Map<string, string>();
  const elementLookup = new Map<string, Record<string, unknown>>();
  const elementsWithText: { dsl: DSLElement; el: Record<string, unknown>; dslId: string; excId: string }[] = [];

  const base = (dsl: BaseDSL, excId: string) => ({
    id: excId,
    type: TYPE_MAP[dsl.type] ?? dsl.type,
    x: Number(dsl.x) || 0,
    y: Number(dsl.y) || 0,
    width: 100,
    height: 40,
    angle: 0,
    strokeColor: resolveColor(dsl.stroke),
    backgroundColor: resolveColor(dsl.fill),
    fillStyle: "solid",
    strokeWidth: dsl.strokeW ?? 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    index: `a${result.length}`,
    seed: Math.floor(Math.random() * 2e9),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2e9),
    isDeleted: false,
    boundElements: [] as { id: string; type: string }[],
    updated: Date.now(),
    link: null,
    locked: false,
  });

  // First pass: create elements
  for (let i = 0; i < elements.length; i++) {
    const d = elements[i];
    if (!d || typeof d !== "object" || !d.type) continue;
    const dslId = String(d.id ?? `e${i}`);
    const excId = genId(dslId);
    idMap.set(dslId, excId);

    const el = base(d as BaseDSL, excId) as Record<string, unknown>;

    if (d.type === "rect" || d.type === "ellipse" || d.type === "diamond") {
      const s = d as DSLShape;
      el.type = TYPE_MAP[s.type];
      el.width = Number(s.w) || 120;
      el.height = Number(s.h) || 80;
      el.roundness = { type: s.type === "rect" ? 3 : 2 };
      if (s.text) elementsWithText.push({ dsl: d, el, dslId, excId });
    } else if (d.type === "arrow") {
      const a = d as DSLArrow;
      el.type = "arrow";
      const ex = Number(a.endX) ?? el.x as number + 100;
      const ey = Number(a.endY) ?? el.y as number;
      const dx = ex - (el.x as number);
      const dy = ey - (el.y as number);
      el.width = Math.abs(dx);
      el.height = Math.abs(dy);
      el.points = [[0, 0], [dx, dy]] as Point[];
      el.roundness = { type: 2 };
      el.startArrowhead = null;
      el.endArrowhead = "arrow";
      el.startBinding = null;
      el.endBinding = null;
      el.lastCommittedPoint = null;
      el.elbowed = false;
    } else if (d.type === "text") {
      const t = d as DSLText;
      el.type = "text";
      el.text = t.text ?? "Text";
      el.fontSize = t.fontSize ?? 20;
      el.fontFamily = 5;
      el.textAlign = "left";
      el.verticalAlign = "top";
      el.containerId = null;
      el.originalText = el.text;
      el.autoResize = true;
      el.lineHeight = 1.25;
      const lines = String(el.text).split("\n");
      const maxLen = Math.max(...lines.map((l) => l.length));
      el.width = maxLen * (el.fontSize as number) * 0.6;
      el.height = lines.length * (el.fontSize as number) * 1.25;
    } else {
      continue;
    }

    result.push(el);
    elementLookup.set(excId, el);
  }

  // Add text elements for shapes with inline text
  for (const { dsl, el, excId } of elementsWithText) {
    const text = (dsl as DSLShape).text;
    if (!text) continue;
    const textId = genId(`${(dsl as BaseDSL).id}_text`);
    const fontSize = (dsl as BaseDSL).fontSize ?? 20;
    const lines = text.split("\n");
    const maxLen = Math.max(...lines.map((l) => l.length));
    const tw = maxLen * fontSize * 0.6;
    const th = lines.length * fontSize * 1.25;
    const w = el.width as number;
    const h = el.height as number;
    const textEl: Record<string, unknown> = {
      ...base(dsl as BaseDSL, textId),
      type: "text",
      text,
      fontSize,
      fontFamily: 5,
      textAlign: "center",
      verticalAlign: "middle",
      containerId: excId,
      originalText: text,
      autoResize: true,
      lineHeight: 1.25,
      width: tw,
      height: th,
      x: (el.x as number) + (w - tw) / 2,
      y: (el.y as number) + (h - th) / 2,
    };
    delete textEl.roundness;
    result.push(textEl);
    elementLookup.set(textId, textEl);
    (el.boundElements as { id: string; type: string }[]).push({ id: textId, type: "text" });
  }

  // Resolve arrow bindings (second pass)
  for (let i = 0; i < elements.length; i++) {
    const d = elements[i];
    if ((d as DSLElement).type !== "arrow") continue;
    const a = d as DSLArrow;
    const excId = idMap.get(String(a.id ?? `e${i}`));
    if (!excId) continue;
    const arrowEl = elementLookup.get(excId) as Record<string, unknown> | undefined;
    if (!arrowEl) continue;

    if (a.startBind && idMap.has(a.startBind)) {
      const targetId = idMap.get(a.startBind)!;
      arrowEl.startBinding = { elementId: targetId, focus: 0, gap: 1 };
      const target = elementLookup.get(targetId) as Record<string, unknown> | undefined;
      if (target?.boundElements) {
        (target.boundElements as { id: string; type: string }[]).push({ id: excId, type: "arrow" });
      }
    }
    if (a.endBind && idMap.has(a.endBind)) {
      const targetId = idMap.get(a.endBind)!;
      arrowEl.endBinding = { elementId: targetId, focus: 0, gap: 1 };
      const target = elementLookup.get(targetId) as Record<string, unknown> | undefined;
      if (target?.boundElements) {
        (target.boundElements as { id: string; type: string }[]).push({ id: excId, type: "arrow" });
      }
    }
  }

  // Resolve text container property
  for (let i = 0; i < elements.length; i++) {
    const d = elements[i] as DSLText;
    if (d.type !== "text" || !d.container) continue;
    const excId = idMap.get(String(d.id ?? `e${i}`));
    const containerId = idMap.get(d.container);
    if (!excId || !containerId) continue;
    const textEl = elementLookup.get(excId) as Record<string, unknown> | undefined;
    const containerEl = elementLookup.get(containerId) as Record<string, unknown> | undefined;
    if (!textEl || !containerEl) continue;
    textEl.containerId = containerId;
    textEl.textAlign = "center";
    textEl.verticalAlign = "middle";
    if (containerEl.boundElements) {
      (containerEl.boundElements as { id: string; type: string }[]).push({ id: excId, type: "text" });
    }
  }

  return result;
}
