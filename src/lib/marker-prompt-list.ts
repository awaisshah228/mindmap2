/**
 * Marker ID list for AI prompts. Must match CUSTOM_MARKER_IDS in CustomMarkerDefs.
 * Kept in lib so prompt-builder (used by server routes) can import without pulling in components.
 */
export const MARKER_IDS_FOR_PROMPT: {
  id: string;
  label: string;
  group: "basic" | "er" | "uml";
}[] = [
  { id: "cm-arrow-open", label: "Arrow (open)", group: "basic" },
  { id: "cm-arrow-closed", label: "Arrow (filled)", group: "basic" },
  { id: "cm-circle", label: "Circle (open)", group: "basic" },
  { id: "cm-circle-filled", label: "Circle (filled)", group: "basic" },
  { id: "cm-diamond", label: "Diamond (open)", group: "basic" },
  { id: "cm-diamond-filled", label: "Diamond (filled)", group: "basic" },
  { id: "cm-bar", label: "Bar ( | )", group: "basic" },
  { id: "cm-er-one", label: "One ( | )", group: "er" },
  { id: "cm-er-many", label: "Many ( > )", group: "er" },
  { id: "cm-er-one-only", label: "One & Only One ( || )", group: "er" },
  { id: "cm-er-zero-or-one", label: "Zero or One ( o| )", group: "er" },
  { id: "cm-er-one-or-many", label: "One or Many ( |> )", group: "er" },
  { id: "cm-er-zero-or-many", label: "Zero or Many ( o> )", group: "er" },
  { id: "cm-uml-composition", label: "Composition ( ◆ )", group: "uml" },
  { id: "cm-uml-aggregation", label: "Aggregation ( ◇ )", group: "uml" },
  { id: "cm-uml-inheritance", label: "Inheritance ( △ )", group: "uml" },
  { id: "cm-uml-realization", label: "Realization ( ▷ )", group: "uml" },
];
