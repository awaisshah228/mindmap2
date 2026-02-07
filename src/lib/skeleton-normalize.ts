/**
 * Normalize skeleton elements (Draw.io / Excalidraw format).
 * Puts shapes first, arrows last, and fixes arrow start/end id references.
 * @param extraShapeIds - Optional extra ids (e.g. diagram node ids) for arrow references.
 */
export function normalizeSkeletons(
  elements: Record<string, unknown>[],
  extraShapeIds?: Set<string> | string[]
): Record<string, unknown>[] {
  const shapes: Record<string, unknown>[] = [];
  const arrows: Record<string, unknown>[] = [];
  for (const el of elements) {
    const t = (el.type as string) ?? "";
    const pts = (el.points ?? []) as unknown[];
    // Line with points (path/polygon shape) goes with shapes; arrow/connector line goes last
    const isPathShape = t === "line" && Array.isArray(pts) && pts.length > 2;
    if ((t === "arrow" || (t === "line" && !isPathShape))) arrows.push(el);
    else shapes.push(el);
  }
  const shapeIds = new Set(shapes.map((s) => String(s.id ?? "")).filter(Boolean));
  if (extraShapeIds) {
    for (const id of extraShapeIds) {
      const s = String(id);
      shapeIds.add(s);
      if (!s.startsWith("ex-")) shapeIds.add(`ex-${s}`);
    }
  }
  const ensureId = (id: string): string =>
    shapeIds.has(id) ? id : shapeIds.has(`ex-${id}`) ? `ex-${id}` : id.startsWith("ex-") ? id : id;
  for (const arr of arrows) {
    const start = arr.start as { id?: string } | undefined;
    const end = arr.end as { id?: string } | undefined;
    if (start?.id) (arr as Record<string, unknown>).start = { ...start, id: ensureId(String(start.id)) };
    if (end?.id) (arr as Record<string, unknown>).end = { ...end, id: ensureId(String(end.id)) };
  }
  return [...shapes, ...arrows];
}
