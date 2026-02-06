import type { ShapeType } from "@/lib/shape-types";

/**
 * Payload for drag-and-drop from toolbar onto the React Flow canvas.
 * Used with HTML Drag and Drop API: dataTransfer.setData(DRAG_PAYLOAD_TYPE, JSON.stringify(payload))
 * @see https://reactflow.dev/examples/interaction/drag-and-drop
 */
export const DRAG_PAYLOAD_TYPE = "application/x-diagram-node";

export type DragNodePayload =
  | { type: "rectangle"; shape?: ShapeType }
  | { type: "stickyNote" }
  | { type: "text" }
  | { type: "mindMap" }
  | { type: "databaseSchema" }
  | { type: "service" }
  | { type: "queue" }
  | { type: "actor" }
  | { type: "group" }
  | { type: "icon"; data: { iconId?: string; emoji?: string; customIcon?: string; label?: string } }
  | { type: "image"; data: { imageUrl: string; label: string } };

export function setDragPayload(dataTransfer: DataTransfer, payload: DragNodePayload): void {
  dataTransfer.setData(DRAG_PAYLOAD_TYPE, JSON.stringify(payload));
  dataTransfer.effectAllowed = "move";
}

export function getDragPayload(dataTransfer: DataTransfer): DragNodePayload | null {
  const raw = dataTransfer.getData(DRAG_PAYLOAD_TYPE);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragNodePayload;
  } catch {
    return null;
  }
}
