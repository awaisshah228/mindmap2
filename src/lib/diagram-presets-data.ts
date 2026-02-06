/**
 * Diagram preset types. Preset data is stored in DB only (diagram_presets table).
 * First-time use: AI generates diagram → saved to preset → loaded from DB thereafter.
 */

export type PresetDiagram = {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: { label: string; icon?: string; iconUrl?: string };
    parentId?: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
    data?: { label?: string };
  }>;
};
