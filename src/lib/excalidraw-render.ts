/**
 * Excalidraw rendering pipeline using the official ExcalidrawElementSkeleton API.
 * LLM output is prepared (unique ids, NaN sanitization) and passed to
 * convertToExcalidrawElements from @excalidraw/excalidraw.
 * @see https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton
 */

export type SkeletonElement = Record<string, unknown>;

const VALID_SHAPE_TYPES = new Set(["rectangle", "diamond", "ellipse", "text", "image", "freedraw", "draw", "frame"]);
const VALID_LINEAR_TYPES = new Set(["arrow", "line"]);
const DEFAULT_VIEWPORT = { width: 1200, height: 800 };

/**
 * Prepare skeleton elements for conversion. Place exactly what the LLM gave — no overlap resolution, no dimension clamping.
 * Only ensures unique ids and sanitizes invalid numbers (NaN/Infinity). Call before normalizeSkeletons and convertToExcalidrawElements.
 */
export function prepareSkeletonForRender(elements: SkeletonElement[]): SkeletonElement[] {
  if (!Array.isArray(elements) || elements.length === 0) return [];

  const seenIds = new Set<string>();
  const result: SkeletonElement[] = [];

  for (const el of elements) {
    if (!el || typeof el !== "object") continue;
    const type = String(el.type ?? "rectangle");
    if (!VALID_SHAPE_TYPES.has(type) && !VALID_LINEAR_TYPES.has(type) && type !== "image") {
      continue; // skip unknown types
    }

    const copy = { ...el } as Record<string, unknown>;
    if (type === "draw") copy.type = "freedraw";

    // Ensure unique id only (preserve original if unique)
    let id = String(copy.id ?? `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    while (seenIds.has(id)) {
      id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    seenIds.add(id);
    copy.id = id;

    // Sanitize only invalid numbers (NaN/Infinity) — keep LLM values otherwise, no clamping
    const safeNum = (val: unknown, fallback: number) =>
      typeof val === "number" && Number.isFinite(val) ? val : fallback;

    if ((VALID_SHAPE_TYPES.has(type) || type === "image") && type !== "freedraw" && type !== "draw" && type !== "frame") {
      copy.x = safeNum(copy.x, 0);
      copy.y = safeNum(copy.y, 0);
      copy.width = safeNum(copy.width, 100);
      copy.height = safeNum(copy.height, 40);
    }
    if (type === "frame") {
      copy.x = safeNum(copy.x, 0);
      copy.y = safeNum(copy.y, 0);
      // frame children and name are passed through; bounds derived from children
    }

    if (type === "freedraw" || type === "draw") {
      copy.x = safeNum(copy.x, 0);
      copy.y = safeNum(copy.y, 0);
      const pts = Array.isArray(copy.points) ? copy.points : [];
      copy.points = pts;
      if (!Array.isArray(copy.pressures) || copy.pressures.length !== pts.length) {
        copy.pressures = pts.map(() => 1);
      }
      // Use LLM width/height if valid; otherwise infer from points
      const w = safeNum(copy.width, 0);
      const h = safeNum(copy.height, 0);
      if (w > 0 && h > 0) {
        copy.width = w;
        copy.height = h;
      } else if (pts.length > 0) {
        const xs = (pts as [number, number][]).map((p) => p[0]);
        const ys = (pts as [number, number][]).map((p) => p[1]);
        copy.width = Math.max(...xs) - Math.min(...xs) + 8;
        copy.height = Math.max(...ys) - Math.min(...ys) + 8;
      } else {
        copy.width = 20;
        copy.height = 20;
      }
    }

    if (VALID_LINEAR_TYPES.has(type)) {
      copy.x = safeNum(copy.x, 0);
      copy.y = safeNum(copy.y, 0);
      copy.width = safeNum(copy.width, 100);
      copy.height = safeNum(copy.height, 24);
    }

    result.push(copy);
  }

  return result;
}

/**
 * Compute appState (scrollX, scrollY, zoom) to fit the diagram in the viewport.
 * Use this for initialData when rendering newly generated content.
 */
export function computeFitViewAppState(
  elements: unknown[],
  viewport: { width: number; height: number } = DEFAULT_VIEWPORT
): { scrollX: number; scrollY: number; zoom: { value: number } } {
  if (!Array.isArray(elements) || elements.length === 0) {
    return { scrollX: 0, scrollY: 0, zoom: { value: 1 } };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements as Record<string, unknown>[]) {
    const type = String(el.type ?? "");
    const x = Number(el.x ?? 0);
    const y = Number(el.y ?? 0);
    const w = Number(el.width ?? 100);
    const h = Number(el.height ?? 40);

    if (VALID_LINEAR_TYPES.has(type) || type === "freedraw" || type === "draw") {
      const points = el.points as [number, number][] | undefined;
      if (Array.isArray(points) && points.length > 0) {
        for (const [px, py] of points) {
          const gx = x + (Number(px) || 0);
          const gy = y + (Number(py) || 0);
          if (gx < minX) minX = gx;
          if (gy < minY) minY = gy;
          if (gx > maxX) maxX = gx;
          if (gy > maxY) maxY = gy;
        }
      } else if (VALID_LINEAR_TYPES.has(type)) {
        const halfW = w / 2;
        const halfH = h / 2;
        minX = Math.min(minX, x - halfW);
        minY = Math.min(minY, y - halfH);
        maxX = Math.max(maxX, x + halfW);
        maxY = Math.max(maxY, y + halfH);
      } else {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);
      }
    } else {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { scrollX: 0, scrollY: 0, zoom: { value: 1 } };
  }

  const sceneW = Math.max(maxX - minX, 100);
  const sceneH = Math.max(maxY - minY, 100);
  const padding = 80;
  const zoomX = (viewport.width - padding * 2) / sceneW;
  const zoomY = (viewport.height - padding * 2) / sceneH;
  const zoom = Math.min(zoomX, zoomY, 1.2);
  const clampedZoom = Math.max(0.1, Math.min(zoom, 3));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const scrollX = viewport.width / 2 - centerX * clampedZoom;
  const scrollY = viewport.height / 2 - centerY * clampedZoom;

  return {
    scrollX,
    scrollY,
    zoom: { value: clampedZoom },
  };
}

/**
 * Full rendering pipeline: prepare skeletons, convert, and compute fit-view appState.
 * Returns { elements, appState } ready for setExcalidrawData.
 */
export async function renderExcalidrawFromSkeletons(
  skeletonElements: SkeletonElement[],
  options?: { viewport?: { width: number; height: number } }
): Promise<{
  elements: unknown[];
  appState: Record<string, unknown>;
}> {
  const { normalizeSkeletons } = await import("@/lib/skeleton-normalize");
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");

  const prepared = prepareSkeletonForRender(skeletonElements);
  const normalized = normalizeSkeletons(prepared);
  const elements = convertToExcalidrawElements(normalized as never[], { regenerateIds: false });

  const viewport = options?.viewport ?? DEFAULT_VIEWPORT;
  const fitState = computeFitViewAppState(elements, viewport);

  // Move viewport to show the diagram initially; user can pan/zoom freely after
  const appState: Record<string, unknown> = {
    scrollX: fitState.scrollX,
    scrollY: fitState.scrollY,
    zoom: fitState.zoom,
  };

  return {
    elements,
    appState,
  };
}
