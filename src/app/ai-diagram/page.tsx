"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import type { Node, Edge } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  getLayoutedElements,
  chooseBestLayoutOptions,
  translateNodesToLayoutBox,
  normalizeMindMapEdgeHandles,
  fitGroupBoundsAndCenterChildren,
  applyGroupingFromMetadata,
  layoutChildrenInsideGroups,
  ensureExtentForGroupedNodes,
  type LayoutDirection,
  type LayoutAlgorithm,
} from "@/lib/layout-engine";
import { resolveCollisionsWithGroups } from "@/lib/resolve-collisions";
import { cn } from "@/lib/utils";
import { buildSystemPrompt, buildUserMessage, getMindMapStructure, type CanvasBounds } from "@/lib/ai/prompt-builder";
import { streamDiagramGeneration } from "@/lib/ai/frontend-ai";
import EditorLayout from "@/components/layout/EditorLayout";
import { saveNow, recordPromptHistory } from "@/lib/store/project-storage";
import { Loader2, Settings } from "lucide-react";
import { applyNodesAndEdgesInChunks } from "@/lib/chunked-nodes";
import { useAnimatedLayout } from "@/hooks/useAnimatedLayout";
import { parseStreamingDiagramBuffer, parseStreamingElementsBuffer } from "@/lib/ai/streaming-json-parser";
import { validateDiagramOutput } from "@/lib/ai/validate-diagram-output";
import { diagramToExcalidraw } from "@/lib/excalidraw-convert";
import { excalidrawToDrawioXml } from "@/lib/excalidraw-to-drawio";
import { validateAndFixXml } from "@/lib/drawio-utils";
import { normalizeSkeletons } from "@/lib/skeleton-normalize";
import { applyCloudIconMatching } from "@/lib/cloud-icon-match";
import { dslToExcalidraw } from "@/lib/j2-converter";
import { computeFitViewAppState } from "@/lib/excalidraw-render";
import { CUSTOM_MARKER_IDS, type CustomMarkerId } from "@/components/edges/CustomMarkerDefs";

/** Apply layout with smooth animation when current nodes overlap target (e.g. streaming → final layout). */
async function applyLayoutWithAnimation(
  setNodes: (n: Node[] | ((prev: Node[]) => Node[])) => void,
  setEdges: (e: Edge[] | ((prev: Edge[]) => Edge[])) => void,
  targetNodes: Node[],
  targetEdges: Edge[],
  currentNodes: Node[],
  applyAnimatedLayout: (
    target: Node[],
    set: (n: Node[] | ((prev: Node[]) => Node[])) => void,
    start: Node[],
    duration?: number
  ) => void
): Promise<void> {
  setEdges(targetEdges);
  const curMap = new Map(currentNodes.map((n) => [n.id, n]));
  const startNodes = targetNodes.map((t) => {
    const cur = curMap.get(t.id);
    return cur?.position ? { ...t, position: cur.position } : t;
  });
  const hasOverlap = targetNodes.some((t) => curMap.has(t.id));
  if (hasOverlap && targetNodes.length > 0) {
    setNodes(startNodes);
    applyAnimatedLayout(targetNodes, setNodes, startNodes, 500);
    return Promise.resolve();
  }
  return applyNodesAndEdgesInChunks(setNodes, setEdges, targetNodes, targetEdges);
}

export const DIAGRAM_TYPE_OPTIONS = [
  { value: "auto", label: "Auto detect (default)" },
  { value: "mindmap", label: "Mind map" },
  { value: "architecture", label: "Cloud / System architecture" },
  { value: "flowchart", label: "Flowchart" },
  { value: "sequence", label: "Sequence diagram" },
  { value: "entity-relationship", label: "Entity relationship" },
  { value: "bpmn", label: "BPMN" },
] as const;

export type DiagramTypeValue = (typeof DIAGRAM_TYPE_OPTIONS)[number]["value"];

/** Preset option for dropdown (value is "none" or preset id from API). */
export type PresetOption = {
  value: string;
  label: string;
  prompt: string;
  previewImageUrl?: string;
  /** Target canvas for this preset; if set, overrides targetCanvas when preset is selected. */
  targetCanvas?: "reactflow" | "excalidraw" | "drawio";
};

/** Cloud model option (admin-configured, for users without API key). */
type CloudModelOption = { id: string; provider: string; model: string; label: string; isDefault: boolean };

/** Small badge showing current model + API key status below the prompt textarea. */
function ModelStatusBadge() {
  const llmProvider = useCanvasStore((s) => s.llmProvider);
  const llmModel = useCanvasStore((s) => s.llmModel);
  const llmApiKey = useCanvasStore((s) => s.llmApiKey);
  const cloudModelId = useCanvasStore((s) => s.cloudModelId);
  const setCloudModelId = useCanvasStore((s) => s.setCloudModelId);
  const hasKey = Boolean(llmApiKey);

  const [cloudModels, setCloudModels] = useState<CloudModelOption[]>([]);
  const cloudModelsInitialized = useRef(false);
  useEffect(() => {
    if (!hasKey) {
      fetch("/api/ai-models")
        .then((r) => (r.ok ? r.json() : { models: [] }))
        .then((d) => {
          const models = d.models ?? [];
          setCloudModels(models);
          // Auto-select default once when no selection and models available
          if (!cloudModelsInitialized.current && cloudModelId == null && models.length > 0) {
            cloudModelsInitialized.current = true;
            const defaultModel = models.find((m: CloudModelOption) => m.isDefault) ?? models[0];
            if (defaultModel) setCloudModelId(defaultModel.id);
          }
        })
        .catch(() => setCloudModels([]));
    } else {
      cloudModelsInitialized.current = false;
    }
  }, [hasKey, cloudModelId, setCloudModelId]);

  const providerLabel =
    llmProvider === "openai" ? "OpenAI"
    : llmProvider === "anthropic" ? "Anthropic"
    : llmProvider === "google" ? "Google"
    : llmProvider === "openrouter" ? "OpenRouter"
    : "Custom";

  const selectedCloudModel = cloudModels.find((m) => m.id === cloudModelId) ?? cloudModels.find((m) => m.isDefault) ?? cloudModels[0];
  const modelDisplay = hasKey ? (llmModel.length > 28 ? llmModel.slice(0, 26) + "…" : llmModel) : (selectedCloudModel?.label ?? "Default");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => useCanvasStore.getState().setSettingsOpen(true, "integration")}
          className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
          title="Click to change AI model or API key"
        >
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${hasKey ? "bg-green-500" : "bg-amber-400"}`} />
            {hasKey ? providerLabel : "Server"}
          </span>
          <span className="text-gray-300">·</span>
          <span className="font-mono truncate max-w-[180px]">{modelDisplay}</span>
          <span className="text-gray-300">·</span>
          <span>{hasKey ? "Own key" : "Server API"}</span>
        </button>
        {!hasKey && cloudModels.length > 1 && (
          <select
            value={cloudModelId ?? selectedCloudModel?.id ?? ""}
            onChange={(e) => setCloudModelId(e.target.value || null)}
            className="text-[11px] rounded px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
          >
            {cloudModels.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        )}
      </div>
      {!hasKey && (
        <button
          type="button"
          onClick={() => useCanvasStore.getState().setSettingsOpen(true, "integration")}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] hover:bg-amber-100 transition-colors"
        >
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Configure your own API key for faster, private AI generation</span>
        </button>
      )}
    </div>
  );
}

export default function AIDiagramPageWrapper() {
  return (
    <Suspense fallback={null}>
      <AIDiagramPage />
    </Suspense>
  );
}

function AIDiagramPage() {
  const { isSignedIn } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<DiagramTypeValue>("auto");
  const [preset, setPreset] = useState<string>("none");
  /** When a preset is selected: "cache" = load saved diagram from DB; "ai" = generate with AI (skip cache). */
  const [presetSource, setPresetSource] = useState<"cache" | "ai">("cache");
  const [apiPresets, setApiPresets] = useState<PresetOption[]>([]);
  const [presetLoading, setPresetLoading] = useState(false);
  /** Target canvas for AI generation: diagram (React Flow), excalidraw, or drawio. */
  const [targetCanvas, setTargetCanvas] = useState<"reactflow" | "excalidraw" | "drawio">("reactflow");
  /** Excalidraw sub-mode: J2 DSL (default) or Mermaid. J2 DSL = create AI Excalidraw default. */
  const [excalidrawMode, setExcalidrawMode] = useState<"mermaid" | "json">("json");
  /** Generate (new) vs Refine (extend existing) — for Excalidraw. */
  const [aiMode, setAiMode] = useState<"generate" | "refine">("generate");
  /** Live LLM response text shown at bottom of AI panel during generation. */
  const [streamingText, setStreamingText] = useState("");
  const streamEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Auto-scroll streaming response to bottom as new content arrives
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [streamingText]);

  // Fetch presets and templates; both can be loaded without sign-in
  useEffect(() => {
    setPresetLoading(true);
    Promise.all([
      fetch("/api/presets?templates=false", { credentials: "omit" }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/presets?templates=true", { credentials: "omit" }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([presetsList, templatesList]) => {
        type Item = { id: string; label: string; prompt?: string; previewImageUrl?: string; targetCanvas?: string };
        const presets = (presetsList as Item[]).map((p) => ({
          value: p.id,
          label: p.label,
          prompt: p.prompt ?? "",
          previewImageUrl: p.previewImageUrl,
          targetCanvas: (p.targetCanvas as "reactflow" | "excalidraw" | "drawio") ?? "reactflow",
        }));
        const templates = (templatesList as Item[]).map((p) => ({
          value: p.id,
          label: `${p.label} (Template)`,
          prompt: p.prompt ?? "",
          previewImageUrl: p.previewImageUrl,
          targetCanvas: (p.targetCanvas as "reactflow" | "excalidraw" | "drawio") ?? "reactflow",
        }));
        setApiPresets([...presets, ...templates]);
      })
      .catch(() => setApiPresets([]))
      .finally(() => setPresetLoading(false));
  }, []);

  // Show only presets that match current canvas mode (filter in local state)
  const presetOptions: PresetOption[] = [
    { value: "none", label: "None (default)", prompt: "" },
    ...apiPresets.filter((p) => p.targetCanvas === targetCanvas),
  ];

  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "diagram";
  const focusNodeId = searchParams.get("nodeId");
  const focusNodeLabelFromQuery = searchParams.get("label") || "";
  const urlPrompt = searchParams.get("prompt");
  const urlPreset = searchParams.get("preset");
  const urlDiagramType = searchParams.get("diagramType");
  const {
    addNodes,
    addEdges,
    setNodes,
    setEdges,
    setPendingFitView,
    setPendingFitViewNodeIds,
    lastAIPrompt,
    lastAIDiagram,
    setLastAIPrompt,
    setLastAIDiagram,
    nodes: canvasNodes,
    edges: canvasEdges,
    mindMapLayout,
    canvasMode,
    setCanvasMode,
    setExcalidrawData,
    incrementExcalidrawScene,
    setExcalidrawGenerating,
    excalidrawData,
    setDrawioData,
    setHasUnsavedChanges,
  } = useCanvasStore() as any;

  const applyAnimatedLayout = useAnimatedLayout();

  // Sync target canvas from current tab when landing on AI page
  useEffect(() => {
    setTargetCanvas(canvasMode);
  }, [canvasMode]);

  // Reset preset when target canvas changes (filtered options differ per canvas)
  const prevTargetCanvas = useRef<"reactflow" | "excalidraw" | "drawio">(targetCanvas);
  useEffect(() => {
    if (prevTargetCanvas.current !== targetCanvas) {
      prevTargetCanvas.current = targetCanvas;
      setPreset("none");
    }
  }, [targetCanvas]);

  // If current preset is not in the filtered list (wrong canvas), reset to none
  const presetInList = preset === "none" || apiPresets.some((p) => p.value === preset && p.targetCanvas === targetCanvas);
  useEffect(() => {
    if (preset !== "none" && !presetInList) setPreset("none");
  }, [preset, presetInList]);

  // Initialize from URL when redirected from AI sidebar or other entry points
  useEffect(() => {
    if (urlPrompt) setPrompt(urlPrompt);
    if (urlPreset) setPreset(urlPreset);
    if (urlDiagramType && DIAGRAM_TYPE_OPTIONS.some((o) => o.value === urlDiagramType)) {
      setDiagramType(urlDiagramType as DiagramTypeValue);
    }
  }, [urlPrompt, urlPreset, urlDiagramType]);

  const focusNode =
    mode === "mindmap-refine" && focusNodeId
      ? (canvasNodes as any[])?.find((n) => n.id === focusNodeId)
      : null;

  // Show selected node(s) on canvas as context (selection is on node.selected from React Flow)
  const selectedNodes =
    (canvasNodes as any[])?.filter((n: any) => n.selected === true) ?? [];
  const hasSelectionContext = selectedNodes.length > 0 && mode !== "mindmap-refine";

  const clearNodeContext = () => {
    setNodes((nodes: { id: string; selected?: boolean; [k: string]: unknown }[]) =>
      nodes.map((n) => ({ ...n, selected: false }))
    );
  };

  /** Sync the same diagram (nodes/edges) to the Excalidraw canvas so both canvases have AI output. */
  const syncDiagramToExcalidraw = async (nodes: Node[], edges: Edge[]) => {
    const skeletons = diagramToExcalidraw(nodes, edges);
    if (skeletons.length === 0) {
      setExcalidrawData(null);
      return;
    }
    const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
    const elements = convertToExcalidrawElements(skeletons as never[], { regenerateIds: false });
    setExcalidrawData({ elements, appState: {} });
    setHasUnsavedChanges(true);
  };

  const handleGenerate = async () => {
    const selectedPreset = presetOptions.find((p) => p.value === preset);
    const effectivePrompt =
      preset !== "none" ? (selectedPreset?.prompt ?? prompt) : prompt;
    if (!effectivePrompt.trim()) return;
    setLoading(true);
    setError(null);
    setStreamingText("");
    const effectiveTarget =
      preset !== "none" && selectedPreset?.targetCanvas
        ? selectedPreset.targetCanvas
        : preset !== "none"
          ? "reactflow"
          : targetCanvas;
    const targetCanvasMode = effectiveTarget;

    try {
      // ─── Preset: load saved from DB (when presetSource === "cache") or skip to AI (when presetSource === "ai") ───
      if (
        preset !== "none" &&
        presetSource === "cache" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(preset)
      ) {
        let data: { drawioData?: string; excalidrawData?: unknown; nodes?: Node[]; edges?: Edge[] } | null = null;
        const presetRes = await fetch(
          `/api/diagrams/preset?preset=${encodeURIComponent(preset)}`,
          { credentials: "omit" }
        );
        if (presetRes.ok) {
          data = await presetRes.json();
        } else if (presetRes.status === 404) {
          setLoading(false);
          setError("No saved diagram for this preset. Choose \"Generate with AI\" to create it.");
          return;
        }
        if (data) {
          if (data.drawioData) {
            setDrawioData(data.drawioData);
            setCanvasMode("drawio");
            setHasUnsavedChanges(true);
            setLastAIPrompt(effectivePrompt.trim());
            setLastAIDiagram(null);
            saveNow();
            recordPromptHistory({ prompt: effectivePrompt.trim(), targetCanvas: "drawio" });
            setPendingFitView(true);
            setLoading(false);
            return;
          }
          if (data.excalidrawData) {
            setExcalidrawData(data.excalidrawData);
            setCanvasMode("excalidraw");
            setHasUnsavedChanges(true);
            setLastAIPrompt(effectivePrompt.trim());
            setLastAIDiagram(null);
            saveNow();
            recordPromptHistory({ prompt: effectivePrompt.trim(), targetCanvas: "excalidraw" });
            setPendingFitView(true);
            setLoading(false);
            return;
          }
          if (Array.isArray(data.nodes) && data.nodes.length > 0) {
            const nodes = data.nodes as Node[];
            const edges = (data.edges ?? []) as Edge[];
            await applyNodesAndEdgesInChunks(setNodes, setEdges, nodes, edges);
            setCanvasMode("reactflow");
            setHasUnsavedChanges(true);
            setLastAIPrompt(effectivePrompt.trim());
            setLastAIDiagram(null);
            saveNow();
            recordPromptHistory({ prompt: effectivePrompt.trim(), nodes, edges, targetCanvas: "reactflow" });
            setPendingFitView(true);
            setPendingFitViewNodeIds(nodes.map((n) => n.id));
            setLoading(false);
            return;
          }
        }
      }

      // Read LLM settings from store
      const { llmProvider, llmModel, llmApiKey, llmBaseUrl, cloudModelId } = useCanvasStore.getState();

      // ─── Draw.io: streaming generation ───
      if (effectiveTarget === "drawio") {
        if (!llmApiKey && !isSignedIn) {
          setLoading(false);
          setError("signup-or-key");
          return;
        }
        const res = await fetch("/api/diagrams/generate-drawio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            prompt: effectivePrompt.trim(),
            llmProvider,
            llmModel,
            llmApiKey: llmApiKey || undefined,
            cloudModelId: !llmApiKey ? cloudModelId ?? undefined : undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error ?? "Failed to generate Draw.io diagram");
        }
        if (!res.body) throw new Error("No response body");
        const decoder = new TextDecoder();
        let streamBuffer = "";
        let lastElementCount = 0;
        const STREAM_BATCH_SIZE = 5;
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            streamBuffer += decoder.decode(value, { stream: true });
            setStreamingText(streamBuffer);
          }
          const parsed = parseStreamingElementsBuffer(streamBuffer);
          const newCount = parsed.elements.length - lastElementCount;
          const shouldUpdate = parsed.elements.length > lastElementCount && (newCount >= STREAM_BATCH_SIZE || done);
          if (shouldUpdate) {
            const normalized = normalizeSkeletons(parsed.elements);
            let xml = excalidrawToDrawioXml(normalized as Parameters<typeof excalidrawToDrawioXml>[0]);
            const v = validateAndFixXml(xml);
            if (v.fixed) xml = v.fixed;
            setDrawioData(xml);
            setCanvasMode("drawio");
            lastElementCount = parsed.elements.length;
          }
          if (done) break;
        }
        const finalParsed = parseStreamingElementsBuffer(streamBuffer);
        if (finalParsed.elements.length === 0) {
          setError("AI returned no elements. Try a different prompt.");
          setLoading(false);
          return;
        }
        const normalized = normalizeSkeletons(finalParsed.elements);
        let xml = excalidrawToDrawioXml(normalized as Parameters<typeof excalidrawToDrawioXml>[0]);
        const v = validateAndFixXml(xml);
        if (v.fixed) xml = v.fixed;
        setDrawioData(xml);
        setCanvasMode("drawio");
        setHasUnsavedChanges(true);
        setLastAIPrompt(effectivePrompt.trim());
        setLastAIDiagram(null);
        // Save generated diagram to preset in DB for future loads
        if (preset !== "none" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(preset)) {
          fetch(`/api/presets/${preset}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ drawioData: xml }),
          }).catch(() => {});
        }
        saveNow();
        recordPromptHistory({ prompt: effectivePrompt.trim(), targetCanvas: "drawio" });
        setPendingFitView(true);
        setLoading(false);
        return;
      }

      // ─── Excalidraw (Mermaid mode): LLM streams Mermaid → mermaid-to-excalidraw → Excalidraw ───
      if (effectiveTarget === "excalidraw" && excalidrawMode === "mermaid") {
        if (!llmApiKey && !isSignedIn) {
          setLoading(false);
          setError("signup-or-key");
          return;
        }
        setCanvasMode("excalidraw");
        setExcalidrawGenerating(true); // Show loader until full response
        const isRefine = aiMode === "refine";
        const existingEls = excalidrawData?.elements;
        const hasExisting = Array.isArray(existingEls) && existingEls.length > 0;
        const existingContext =
          isRefine && hasExisting
            ? (existingEls as { type?: string; id?: string; text?: string; label?: { text?: string } }[])
                .slice(0, 30)
                .map((e) => {
                  const label = e.text ?? e.label?.text ?? e.type ?? e.id;
                  return `${e.type ?? "element"} ${e.id ?? ""}: ${label}`.trim();
                })
                .join("; ")
            : undefined;

        const res = await fetch("/api/diagrams/generate-mermaid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            prompt: effectivePrompt.trim(),
            llmProvider,
            llmModel,
            llmApiKey: llmApiKey || undefined,
            cloudModelId: !llmApiKey ? cloudModelId ?? undefined : undefined,
            refine: isRefine && hasExisting,
            existingContext,
          }),
        });
        if (!res.ok) {
          setExcalidrawGenerating(false);
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error ?? "Failed to generate Mermaid diagram");
        }
        if (!res.body) throw new Error("No response body");
        const decoder = new TextDecoder();
        let streamBuffer = "";
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            streamBuffer += decoder.decode(value, { stream: true });
            setStreamingText(streamBuffer);
          }
          if (done) break;
        }
        let mermaid = streamBuffer.trim();
        const mermaidMatch = mermaid.match(/```(?:mermaid)?\s*([\s\S]*?)```/);
        if (mermaidMatch) mermaid = mermaidMatch[1].trim();
        if (!mermaid) {
          setExcalidrawGenerating(false);
          setError("AI did not return valid Mermaid code. Try a different prompt.");
          setLoading(false);
          return;
        }
        const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
        const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
        const { elements: skeletonElements, files } = await parseMermaidToExcalidraw(mermaid, {
          themeVariables: { fontSize: "16px" },
        });
        if (!skeletonElements?.length) {
          setExcalidrawGenerating(false);
          setError("Mermaid could not be converted. Try flowchart, sequence, or class diagram syntax.");
          setLoading(false);
          return;
        }
        const elements = convertToExcalidrawElements(skeletonElements as never[], { regenerateIds: false });
        const viewport = typeof window !== "undefined" ? { width: window.innerWidth, height: window.innerHeight } : undefined;
        const { computeFitViewAppState } = await import("@/lib/excalidraw-render");
        const fitState = computeFitViewAppState(elements, viewport);
        const appState = { scrollX: fitState.scrollX, scrollY: fitState.scrollY, zoom: fitState.zoom };
        const excalidrawPayload = { elements, appState, files: files ?? undefined };
        setExcalidrawData(excalidrawPayload);
        incrementExcalidrawScene(); // Remount canvas with full parsed data
        setExcalidrawGenerating(false);
        setCanvasMode("excalidraw");
        setHasUnsavedChanges(true);
        setLastAIPrompt(effectivePrompt.trim());
        setLastAIDiagram(null);
        // Save to preset with mermaid source + excalidraw cached
        if (preset !== "none" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(preset)) {
          fetch(`/api/presets/${preset}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              dataFormat: "mermaid",
              mermaidData: mermaid,
              excalidrawData: excalidrawPayload,
            }),
          }).catch(() => {});
        }
        saveNow();
        recordPromptHistory({ prompt: effectivePrompt.trim(), targetCanvas: "excalidraw" });
        setPendingFitView(true);
        setLoading(false);
        // Navigate to editor and close AI panel when Excalidraw (Mermaid) generation completes
        router.push("/editor");
        return;
      }

      // ─── Excalidraw (J2 DSL mode): streaming DSL → j2-converter → Excalidraw ───
      if (effectiveTarget === "excalidraw" && excalidrawMode === "json") {
        if (!llmApiKey && !isSignedIn) {
          setLoading(false);
          setError("signup-or-key");
          return;
        }
        setCanvasMode("excalidraw");
        setExcalidrawGenerating(true); // Show loader until full response
        const isRefine = aiMode === "refine";
        const existingEls = excalidrawData?.elements;
        const hasExisting = Array.isArray(existingEls) && existingEls.length > 0;

        const res = await fetch("/api/diagrams/generate-excalidraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            prompt: effectivePrompt.trim(),
            llmProvider,
            llmModel,
            llmApiKey: llmApiKey || undefined,
            cloudModelId: !llmApiKey ? cloudModelId ?? undefined : undefined,
            refine: isRefine && hasExisting,
            existingElements: isRefine && hasExisting ? existingEls : undefined,
          }),
        });
        if (!res.ok) {
          setExcalidrawGenerating(false);
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error ?? "Failed to generate Excalidraw diagram");
        }
        if (!res.body) throw new Error("No response body");
        const decoder = new TextDecoder();
        let streamBuffer = "";
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            streamBuffer += decoder.decode(value, { stream: true });
            setStreamingText(streamBuffer);
          }
          if (done) break;
        }
        const finalParsed = parseStreamingElementsBuffer(streamBuffer);
        if (finalParsed.elements.length === 0) {
          setExcalidrawGenerating(false);
          setError("AI returned no elements. Try a different prompt.");
          setLoading(false);
          return;
        }
        const elements = dslToExcalidraw(finalParsed.elements);
        const viewport = typeof window !== "undefined" ? { width: window.innerWidth, height: window.innerHeight } : undefined;
        const fitState = computeFitViewAppState(elements, viewport);
        const appState = { scrollX: fitState.scrollX, scrollY: fitState.scrollY, zoom: fitState.zoom };
        const excalidrawPayload = { elements, appState };
        setExcalidrawData(excalidrawPayload);
        incrementExcalidrawScene(); // Remount canvas with full parsed data
        setExcalidrawGenerating(false);
        setCanvasMode("excalidraw");
        setHasUnsavedChanges(true);
        setLastAIPrompt(effectivePrompt.trim());
        setLastAIDiagram(null);
        // Save generated diagram to preset in DB for future loads (J2/DSL format)
        if (preset !== "none" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(preset)) {
          fetch(`/api/presets/${preset}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              dataFormat: "json",
              excalidrawData: excalidrawPayload,
            }),
          }).catch(() => {});
        }
        saveNow();
        recordPromptHistory({ prompt: effectivePrompt.trim(), targetCanvas: "excalidraw" });
        setPendingFitView(true);
        setLoading(false);
        // Navigate to editor and close AI panel when Excalidraw (J2 DSL) generation completes
        router.push("/editor");
        return;
      }

      const effectiveDiagramType = mode === "mindmap-refine" ? "mindmap" : diagramType;

      // ─── Compute bounding box of existing canvas nodes ─────────
      const existingNodes = Array.isArray(canvasNodes) ? canvasNodes : [];
      const existingEdges = Array.isArray(canvasEdges) ? canvasEdges : [];
      const mindMapStructure =
        mode === "mindmap-refine" && focusNodeId && existingNodes.length > 0
          ? getMindMapStructure(existingNodes as { id: string; data?: { label?: string } }[], existingEdges as { source: string; target: string }[], focusNodeId)
          : null;
      let canvasBounds: CanvasBounds | null = null;
      if (existingNodes.length > 0) {
        const DEFAULT_W = 150;
        const DEFAULT_H = 50;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of existingNodes as { position?: { x: number; y: number }; measured?: { width?: number; height?: number }; width?: number; height?: number; style?: { width?: number; height?: number } }[]) {
          const x = n.position?.x ?? 0;
          const y = n.position?.y ?? 0;
          const w = (n.measured?.width ?? n.width ?? n.style?.width ?? DEFAULT_W) as number;
          const h = (n.measured?.height ?? n.height ?? n.style?.height ?? DEFAULT_H) as number;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x + w > maxX) maxX = x + w;
          if (y + h > maxY) maxY = y + h;
        }
        canvasBounds = { minX, minY, maxX, maxY, nodeCount: existingNodes.length };
      }

      let parsed: Record<string, unknown> | null = null;
      const isNewDiagram = mode !== "mindmap-refine";
      const refId = isNewDiagram ? `ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` : null;

      // ─── Preset (React Flow): stream nodes/edges from DB when presetSource === "cache"; else use AI ──
      const nodeIdMap = new Map<string, string>();
      if (
        preset !== "none" &&
        presetSource === "cache" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(preset)
      ) {
        const presetRes = await fetch(
          `/api/diagrams/preset/stream?preset=${encodeURIComponent(preset)}`,
          { credentials: "omit" }
        );
        if (!presetRes.ok || !presetRes.body) {
          setLoading(false);
          setError("No saved diagram for this preset. Choose \"Generate with AI\" to create it.");
          return;
        } else {
          const MIN_NODES_PER_CHUNK_PRESET = 2;
          let full = "";
          let streamBuffer = "";
          let lastAppliedNodeCount = 0;
          let lastAppliedEdgeCount = 0;
          let streamingLayoutVersion = 0;

          const processStreamChunk = (delta: string, done?: boolean) => {
            streamBuffer += delta;
            const res = parseStreamingDiagramBuffer(streamBuffer);
            const store = useCanvasStore.getState();
            const setNodesNow = store.setNodes;
            const setEdgesNow = store.setEdges;
            const STREAM_COLS = 6;
            const STREAM_DX = 200;
            const STREAM_DY = 100;
            for (let i = 0; i < res.nodes.length; i++) {
              const raw = res.nodes[i] as { id: string; [k: string]: unknown };
              nodeIdMap.set(raw.id, refId ? `${refId}-${raw.id}` : raw.id);
            }
            const newNodeCount = res.nodes.length - lastAppliedNodeCount;
            const shouldApply = newNodeCount >= MIN_NODES_PER_CHUNK_PRESET || done;
            if (shouldApply && res.nodes.length > lastAppliedNodeCount) {
              const batchNodes: Node[] = [];
              for (let i = lastAppliedNodeCount; i < res.nodes.length; i++) {
                const raw = res.nodes[i] as { id: string; type?: string; parentId?: string; [k: string]: unknown };
                if (raw.type === "group") continue;
                const newId = nodeIdMap.get(raw.id)!;
                const newParentId = raw.parentId && refId ? `${refId}-${raw.parentId}` : (raw.parentId as string | undefined);
                const rawPos = raw.position as { x: number; y: number } | undefined;
                const hasValidPos = rawPos && typeof rawPos.x === "number" && typeof rawPos.y === "number";
                const streamingPosition = hasValidPos
                  ? rawPos
                  : { x: (i % STREAM_COLS) * STREAM_DX, y: Math.floor(i / STREAM_COLS) * STREAM_DY };
                batchNodes.push({
                  id: newId,
                  type: (raw.type as string) || "rectangle",
                  position: streamingPosition,
                  data: (raw.data as Record<string, unknown>) ?? {},
                  ...(newParentId && { parentId: newParentId, extent: "parent" as const }),
                });
              }
              const batchEdges: Edge[] = [];
              for (let i = lastAppliedEdgeCount; i < res.edges.length; i++) {
                const raw = res.edges[i] as { id?: string; source: string; target: string; [k: string]: unknown };
                const source = nodeIdMap.get(raw.source) ?? raw.source;
                const target = nodeIdMap.get(raw.target) ?? raw.target;
                batchEdges.push({
                  id: raw.id ? (refId ? `${refId}-${raw.id}` : raw.id) : `e-${source}-${target}-${i}`,
                  source,
                  target,
                  ...(raw.data != null && typeof raw.data === "object" && !Array.isArray(raw.data)
                    ? { data: raw.data as Record<string, unknown> }
                    : {}),
                });
              }
              const prevNodes: Node[] = store.nodes;
              const prevEdges: Edge[] = store.edges;
              const mergedNodes: Node[] =
                lastAppliedNodeCount === 0 && isNewDiagram
                  ? batchNodes
                  : (() => {
                      const byId = new Map<string, Node>(prevNodes.map((n: Node) => [n.id, n]));
                      for (const n of batchNodes) byId.set(n.id, n);
                      return [...byId.values()];
                    })();
              const mergedEdges: Edge[] =
                lastAppliedNodeCount === 0 && isNewDiagram
                  ? batchEdges
                  : (() => {
                      const byId = new Map<string, Edge>(prevEdges.map((e: Edge) => [e.id, e]));
                      for (const e of batchEdges) byId.set(e.id, e);
                      return [...byId.values()];
                    })();
              setNodesNow(mergedNodes.length ? mergedNodes : []);
              setEdgesNow(mergedEdges);
              lastAppliedNodeCount = res.nodes.length;
              lastAppliedEdgeCount = res.edges.length;

              // After each chunk: run full "Layout all" on all previously rendered nodes from this stream
              streamingLayoutVersion += 1;
              const myVersion = streamingLayoutVersion;
              (async () => {
                try {
                  const LAYOUT_EXCLUDED = new Set(["freeDraw", "edgeAnchor"]);
                  const targetNodes = mergedNodes.filter((n) => !LAYOUT_EXCLUDED.has((n.type as string) ?? ""));
                  const targetIds = new Set(targetNodes.map((n) => n.id));
                  const targetEdges = mergedEdges.filter(
                    (e) => targetIds.has(e.source) && targetIds.has(e.target)
                  );
                  if (targetNodes.length < 2) return;
                  const { algorithm, direction, spacing } = chooseBestLayoutOptions(
                    targetNodes,
                    targetEdges,
                    targetIds
                  );
                  const { nodes: layoutedNodes, edges: layoutedEdges } =
                    await getLayoutedElements(
                      targetNodes,
                      targetEdges,
                      direction,
                      spacing,
                      algorithm
                    );
                  const withGroupChildren = await layoutChildrenInsideGroups(
                    layoutedNodes,
                    layoutedEdges,
                    direction,
                    [40, 32]
                  );
                  const collisionFreeNodes = resolveCollisionsWithGroups(
                    ensureExtentForGroupedNodes(withGroupChildren),
                    { maxIterations: 150, overlapThreshold: 0, margin: 24 }
                  );
                  // Place layout in a box (content bounds + padding), not the whole canvas
                  const LAYOUT_BOX_PADDING = 40;
                  const nodesInLayoutBox = translateNodesToLayoutBox(
                    collisionFreeNodes,
                    LAYOUT_BOX_PADDING
                  );
                  if (streamingLayoutVersion !== myVersion) return;
                  const store = useCanvasStore.getState();
                  store.setNodes((all: Node[]) =>
                    all.map((n) => {
                      const ln = nodesInLayoutBox.find((x) => x.id === n.id);
                      return ln ? { ...n, position: ln.position } : n;
                    })
                  );
                  store.setEdges((all: Edge[]) =>
                    all.map((e) => {
                      const le = layoutedEdges.find((x) => x.id === e.id);
                      return le
                        ? {
                            ...e,
                            sourceHandle: le.sourceHandle ?? e.sourceHandle,
                            targetHandle: le.targetHandle ?? e.targetHandle,
                          }
                        : e;
                    })
                  );
                  useCanvasStore.getState().setPendingFitView(true);
                } catch {
                  // ignore
                }
              })();
            }
          };

          const reader = presetRes.body!.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              full += chunk;
              processStreamChunk(chunk);
            }
          }
          full += decoder.decode();
          processStreamChunk("", true);

          try {
            parsed = JSON.parse(full.trim()) as Record<string, unknown>;
          } catch {
            setError("Preset returned invalid JSON");
            setLoading(false);
            return;
          }
          // If preset has no pre-built diagram, show error when loading saved only
          const presetNodes = parsed?.nodes;
          if (Array.isArray(presetNodes) && presetNodes.length === 0) {
            setLoading(false);
            setError("No saved diagram for this preset. Choose \"Generate with AI\" to create it.");
            return;
          }
        }
      }

      // ─── Custom prompt (no preset or preset with no diagram): require sign-in or API key when local ──
      if (!parsed && !llmApiKey && !isSignedIn) {
        setLoading(false);
        setError("signup-or-key");
        return;
      }

      // ─── Call LLM: use user's API key + selected model when set; otherwise server (credits). Stream in both cases. ──
      /** Minimum nodes to apply per chunk so we render in batches instead of node-by-node. */
      const MIN_NODES_PER_CHUNK = 2;

      if (!parsed) {
        let full = "";
        let streamBuffer = "";
        let lastAppliedNodeCount = 0;
        let lastAppliedEdgeCount = 0;
        let streamingLayoutVersion = 0;

        const processStreamChunk = (delta: string, done?: boolean) => {
          streamBuffer += delta;
          const res = parseStreamingDiagramBuffer(streamBuffer);
          const store = useCanvasStore.getState();
          const setNodesNow = store.setNodes;
          const setEdgesNow = store.setEdges;
          const STREAM_COLS = 6;
          const STREAM_DX = 200;
          const STREAM_DY = 100;

          // Ensure nodeIdMap is populated for all parsed nodes (needed for edge source/target mapping)
          for (let i = 0; i < res.nodes.length; i++) {
            const raw = res.nodes[i] as { id: string; type?: string; [k: string]: unknown };
            const newId = refId ? `${refId}-${raw.id}` : raw.id;
            nodeIdMap.set(raw.id, newId);
          }

          const newNodeCount = res.nodes.length - lastAppliedNodeCount;
          const shouldApply = newNodeCount >= MIN_NODES_PER_CHUNK || done;

          if (shouldApply && res.nodes.length > lastAppliedNodeCount) {
            const batchNodes: Node[] = [];
            for (let i = lastAppliedNodeCount; i < res.nodes.length; i++) {
              const raw = res.nodes[i] as { id: string; type?: string; parentId?: string; [k: string]: unknown };
              if (raw.type === "group") continue;
              const newId = nodeIdMap.get(raw.id)!;
              const newParentId = raw.parentId && refId ? `${refId}-${raw.parentId}` : (raw.parentId as string | undefined);
              const rawPos = raw.position as { x: number; y: number } | undefined;
              const hasValidPos = rawPos && typeof rawPos.x === "number" && typeof rawPos.y === "number";
              const streamingPosition = hasValidPos
                ? rawPos
                : { x: (i % STREAM_COLS) * STREAM_DX, y: Math.floor(i / STREAM_COLS) * STREAM_DY };
              batchNodes.push({
                id: newId,
                type: (raw.type as string) || "rectangle",
                position: streamingPosition,
                data: (raw.data as Record<string, unknown>) ?? {},
                ...(newParentId && { parentId: newParentId, extent: "parent" as const }),
              });
            }
            const batchEdges: Edge[] = [];
            for (let i = lastAppliedEdgeCount; i < res.edges.length; i++) {
              const raw = res.edges[i] as { id?: string; source: string; target: string; [k: string]: unknown };
              const source = nodeIdMap.get(raw.source) ?? raw.source;
              const target = nodeIdMap.get(raw.target) ?? raw.target;
              batchEdges.push({
                id: raw.id ? (refId ? `${refId}-${raw.id}` : raw.id) : `e-${source}-${target}-${i}`,
                source,
                target,
                ...(raw.data != null && typeof raw.data === "object" && !Array.isArray(raw.data)
                  ? { data: raw.data as Record<string, unknown> }
                  : {}),
              });
            }
            const prevNodes: Node[] = store.nodes;
            const prevEdges: Edge[] = store.edges;
            const mergedNodes: Node[] =
              lastAppliedNodeCount === 0 && isNewDiagram
                ? batchNodes
                : (() => {
                    const byId = new Map<string, Node>(prevNodes.map((n: Node) => [n.id, n]));
                    for (const n of batchNodes) byId.set(n.id, n);
                    return [...byId.values()];
                  })();
            const mergedEdges: Edge[] =
              lastAppliedNodeCount === 0 && isNewDiagram
                ? batchEdges
                : (() => {
                    const byId = new Map<string, Edge>(prevEdges.map((e: Edge) => [e.id, e]));
                    for (const e of batchEdges) byId.set(e.id, e);
                    return [...byId.values()];
                  })();
            setNodesNow(mergedNodes.length ? mergedNodes : []);
            setEdgesNow(mergedEdges);
            lastAppliedNodeCount = res.nodes.length;
            lastAppliedEdgeCount = res.edges.length;

            // After each chunk: run full "Layout all" on all previously rendered nodes from AI response
            streamingLayoutVersion += 1;
            const myVersion = streamingLayoutVersion;
            (async () => {
              try {
                const LAYOUT_EXCLUDED = new Set(["freeDraw", "edgeAnchor"]);
                const targetNodes = mergedNodes.filter((n) => !LAYOUT_EXCLUDED.has((n.type as string) ?? ""));
                const targetIds = new Set(targetNodes.map((n) => n.id));
                const targetEdges = mergedEdges.filter(
                  (e) => targetIds.has(e.source) && targetIds.has(e.target)
                );
                if (targetNodes.length < 2) return;
                const { algorithm, direction, spacing } = chooseBestLayoutOptions(
                  targetNodes,
                  targetEdges,
                  targetIds
                );
                const { nodes: layoutedNodes, edges: layoutedEdges } =
                  await getLayoutedElements(
                    targetNodes,
                    targetEdges,
                    direction,
                    spacing,
                    algorithm
                  );
                const withGroupChildren = await layoutChildrenInsideGroups(
                  layoutedNodes,
                  layoutedEdges,
                  direction,
                  [40, 32]
                );
                const collisionFreeNodes = resolveCollisionsWithGroups(
                  ensureExtentForGroupedNodes(withGroupChildren),
                  { maxIterations: 150, overlapThreshold: 0, margin: 24 }
                );
                // Place layout in a box (content bounds + padding), not the whole canvas
                const LAYOUT_BOX_PADDING = 40;
                const nodesInLayoutBox = translateNodesToLayoutBox(
                  collisionFreeNodes,
                  LAYOUT_BOX_PADDING
                );
                if (streamingLayoutVersion !== myVersion) return;
                const store = useCanvasStore.getState();
                store.setNodes((all: Node[]) =>
                  all.map((n) => {
                    const ln = nodesInLayoutBox.find((x) => x.id === n.id);
                    return ln ? { ...n, position: ln.position } : n;
                  })
                );
                store.setEdges((all: Edge[]) =>
                  all.map((e) => {
                    const le = layoutedEdges.find((x) => x.id === e.id);
                    return le
                      ? {
                          ...e,
                          sourceHandle: le.sourceHandle ?? e.sourceHandle,
                          targetHandle: le.targetHandle ?? e.targetHandle,
                        }
                      : e;
                  })
                );
                useCanvasStore.getState().setPendingFitView(true);
              } catch {
                // ignore layout errors during stream (e.g. empty graph)
              }
            })();
          }
        };

        if (llmApiKey) {
          // Stream frontend LLM response: user's API key + selected provider/model; onChunk updates diagram as tokens arrive.
          const systemPrompt = buildSystemPrompt("horizontal");
          const userMessage = buildUserMessage({
            prompt: effectivePrompt.trim(),
            layoutDirection: "horizontal",
            mode,
            focusNodeId,
            diagramType: effectiveDiagramType,
            previousPrompt: lastAIPrompt,
            previousDiagram: lastAIDiagram as Record<string, unknown> | null,
            canvasBounds,
            mindMapStructure,
          });
          full = await streamDiagramGeneration({
            provider: llmProvider,
            model: llmModel,
            apiKey: llmApiKey,
            baseUrl: llmBaseUrl || undefined,
            systemPrompt,
            userMessage,
            onChunk: (delta) => {
              processStreamChunk(delta);
              setStreamingText((prev) => prev + delta);
            },
          });
          processStreamChunk("", true);
        } else {
          // Signed in, no API key: use server Langchain; response is streamed and processed in chunks.
          const res = await fetch("/api/diagrams/langchain", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              prompt: effectivePrompt.trim(),
              previousPrompt: lastAIPrompt,
              previousDiagram: lastAIDiagram,
              layoutDirection: "horizontal",
              mode,
              focusNodeId,
              diagramType: effectiveDiagramType,
              llmProvider,
              llmModel,
              llmApiKey: llmApiKey || undefined,
              cloudModelId: !llmApiKey ? cloudModelId ?? undefined : undefined,
              canvasBounds,
              mindMapStructure,
            }),
          });
          if (!res.ok || !res.body) {
            let data: Record<string, unknown> = {};
            try {
              data = await res.json();
            } catch {
              // ignore
            }
            throw new Error((data?.error as string) || "Failed to generate diagram");
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              full += chunk;
              setStreamingText(full);
              processStreamChunk(chunk);
            }
          }
          full += decoder.decode();
          processStreamChunk("", true);
        }
        try {
          let jsonStr = full.trim();
          if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
          }
          parsed = JSON.parse(jsonStr) as Record<string, unknown>;
        } catch {
          throw new Error("AI returned invalid JSON diagram");
        }
      }

      const { nodes, edges, layoutDirection, groups: rawGroups } = parsed ?? {};
      const validated = validateDiagramOutput(nodes, edges);
      let safeNodes = (validated.nodes as { id: string; type?: string; [k: string]: unknown }[]).filter((n) => n.type !== "group");
      let rawEdges = validated.edges;
      if (validated.errors.length > 0) {
        console.warn("Diagram validation:", validated.errors.slice(0, 5).join("; "));
      }
      let groupMetadata: { id: string; label: string; nodeIds: string[] }[] = Array.isArray(rawGroups)
        ? (rawGroups as { id?: string; label?: string; nodeIds?: string[] }[])
            .filter((g) => g && typeof g.id === "string" && Array.isArray(g.nodeIds))
            .map((g) => ({ id: g.id!, label: String(g.label ?? g.id), nodeIds: g.nodeIds!.filter((id): id is string => typeof id === "string") }))
        : [];

      // New diagram (not refine): use a unique reference id so node/edge ids never mix with existing or between runs.
      if (refId) {
        const nodeIdMap = new Map(
          safeNodes.map((n: { id: string }) => [n.id, `${refId}-${n.id}`])
        );
        safeNodes = safeNodes.map((n: { id: string; parentId?: string; extent?: string; [k: string]: unknown }) => {
          const newId = nodeIdMap.get(n.id) ?? n.id;
          const newParentId = typeof n.parentId === "string" && nodeIdMap.has(n.parentId) ? nodeIdMap.get(n.parentId) : undefined;
          return {
            ...n,
            id: newId,
            ...(newParentId != null && { parentId: newParentId }),
            extent: newParentId ? "parent" : n.extent,
          };
        });
        // Remap edges with unique ids so they never collide: refId-e-<index>-<source>-<target>
        rawEdges = rawEdges
          .filter(
            (e: { id?: string; source?: string; target?: string }) =>
              e &&
              typeof e.id === "string" &&
              typeof e.source === "string" &&
              typeof e.target === "string" &&
              nodeIdMap.has(e.source) &&
              nodeIdMap.has(e.target)
          )
          .map((e, index) => {
            const src = String((e as { source: string }).source);
            const tgt = String((e as { target: string }).target);
            return {
              ...e,
              id: `${refId}-e-${index}-${src}-${tgt}`,
              source: nodeIdMap.get(src) ?? src,
              target: nodeIdMap.get(tgt) ?? tgt,
            };
          });
        const nodeIdsSet = new Set(safeNodes.map((n: { id: string }) => n.id));
        groupMetadata = groupMetadata
          .map((g) => ({
            id: `${refId}-${g.id}`,
            label: g.label,
            nodeIds: g.nodeIds.map((id) => nodeIdMap.get(id) ?? id).filter((id) => nodeIdsSet.has(id)),
          }))
          .filter((g) => g.nodeIds.length > 0);
      }

      // Ensure all nodes have position (auto-layout overwrites; AI may omit position)
      safeNodes = safeNodes.map((n: { id: string; position?: { x: number; y: number }; [k: string]: unknown }) => ({
        ...n,
        position: n.position && typeof n.position.x === "number" && typeof n.position.y === "number"
          ? n.position
          : { x: 0, y: 0 },
      }));

      const nodeIds = new Set(safeNodes.map((n: { id: string }) => n.id));
      const connectedEdges = refId
        ? rawEdges
        : rawEdges.filter(
            (e: { id?: string; source?: string; target?: string }) =>
              e &&
              typeof e.id === "string" &&
              typeof e.source === "string" &&
              typeof e.target === "string" &&
              nodeIds.has(e.source) &&
              nodeIds.has(e.target)
          );

      // Normalize handles for clean connections based on node positions.
      const nodeById = new Map<string, { position?: { x: number; y: number } }>(
        safeNodes.map((n: { id: string; position?: { x: number; y: number } }) => [n.id, n])
      );
      const normalizedEdges = connectedEdges.map((e: any) => {
        let sourceHandle: string | undefined = e.sourceHandle;
        let targetHandle: string | undefined = e.targetHandle;

        const sourceNode = nodeById.get(e.source);
        const targetNode = nodeById.get(e.target);

        if (sourceNode && targetNode) {
          const sx = sourceNode.position?.x ?? 0;
          const sy = sourceNode.position?.y ?? 0;
          const tx = targetNode.position?.x ?? 0;
          const ty = targetNode.position?.y ?? 0;
          const dx = tx - sx;
          const dy = ty - sy;

          if (!sourceHandle || !targetHandle) {
            if (Math.abs(dx) >= Math.abs(dy)) {
              // Horizontal-ish
              sourceHandle = sourceHandle ?? (dx >= 0 ? "right" : "left");
              targetHandle = targetHandle ?? (dx >= 0 ? "left" : "right");
            } else {
              // Vertical-ish
              sourceHandle = sourceHandle ?? (dy >= 0 ? "bottom" : "top");
              targetHandle = targetHandle ?? (dy >= 0 ? "top" : "bottom");
            }
          }
        }

        return {
          ...e,
          sourceHandle,
          targetHandle,
        };
      });

      // Match node labels to admin-uploaded cloud icons
      safeNodes = (await applyCloudIconMatching(safeNodes)) as typeof safeNodes;

      if (safeNodes.length === 0) {
        setError(
          preset !== "none"
            ? "This preset has no pre-built diagram. Sign in or add your API key, then Generate again to create it with AI, or choose another preset."
            : "No diagram data — AI returned no nodes. Try a different prompt."
        );
        setLoading(false);
        return;
      }

      // Mind map: use tree layout and current mind map settings; otherwise generic layered.
      const isMindMapDiagram =
        safeNodes.length > 0 &&
        safeNodes.every((n: { type?: string }) => n.type === "mindMap");
      const hasGroups = groupMetadata.length > 0;
      const nodeCount = safeNodes.length;
      const edgeCount = connectedEdges.length;
      const isDenseDiagram = nodeCount >= 8 || edgeCount >= 10;
      const hasActors = safeNodes.some((n: { type?: string }) => n.type === "actor");
      const isSequenceDiagram = effectiveDiagramType === "sequence" && hasActors;
      const isFlowchartDiagram = effectiveDiagramType === "flowchart";
      const isBpmnDiagram = effectiveDiagramType === "bpmn";

      // Diagram-type-specific layout: flowchart/BPMN/sequence → TB (time/flow down), architecture → LR
      const direction: LayoutDirection = isMindMapDiagram
        ? (mindMapLayout?.direction ?? "LR")
        : layoutDirection === "vertical"
          ? "TB"
          : isFlowchartDiagram || isBpmnDiagram || isSequenceDiagram
            ? "TB"
            : "LR";
      const spacing: [number, number] = isMindMapDiagram
        ? [mindMapLayout?.spacingX ?? 120, mindMapLayout?.spacingY ?? 100]
        : hasGroups
          ? isDenseDiagram
            ? [280, 220]
            : [240, 200]
          : isDenseDiagram
            ? [200, 160]
            : [160, 120];
      const layoutAlgorithm: LayoutAlgorithm = isMindMapDiagram
        ? (mindMapLayout?.algorithm ?? "elk-mrtree")
        : isSequenceDiagram
          ? "elk-layered"
          : "elk-layered";

      // Layout all nodes flat (no group nodes yet). Then apply grouping at render time
      // (like user selecting nodes and Ctrl+G / sidebar group tool).
      const layoutResult = await getLayoutedElements(
        safeNodes as Node[],
        normalizedEdges,
        direction,
        spacing,
        layoutAlgorithm
      );
      let layoutedNodes = layoutResult.nodes;
      let layoutedEdges = layoutResult.edges;

      // Beautify: smoothstep, distinct stroke colors, flow direction, thinner for dense.
      if (!isMindMapDiagram) {
        const isDense = layoutedNodes.length >= 8 || layoutedEdges.length >= 10;
        const STROKE_COLORS = [
          "#3b82f6", "#22c55e", "#eab308", "#f97316", "#ec4899",
          "#8b5cf6", "#14b8a6", "#ef4444", "#6366f1", "#a855f7",
        ];
        const validMarkerIds = new Set<string>(Object.values(CUSTOM_MARKER_IDS));
        // Always use Bezier (default) for AI-generated diagrams; apply data.markerEnd/markerStart when valid
        layoutedEdges = layoutedEdges.map((edge: Edge, idx: number) => {
          const d = typeof edge.data === "object" && edge.data ? edge.data : {};
          const dataMarkerEnd = (d.markerEnd as string) ?? (edge as { markerEnd?: string }).markerEnd;
          const dataMarkerStart = (d.markerStart as string) ?? (edge as { markerStart?: string }).markerStart;
          const markerEnd: CustomMarkerId | undefined = dataMarkerEnd && validMarkerIds.has(dataMarkerEnd) ? (dataMarkerEnd as CustomMarkerId) : undefined;
          const markerStart: CustomMarkerId | undefined = dataMarkerStart && validMarkerIds.has(dataMarkerStart) ? (dataMarkerStart as CustomMarkerId) : undefined;
          return {
            ...edge,
            type: "labeledConnector" as const,
            ...(markerEnd !== undefined && { markerEnd }),
            ...(markerStart !== undefined && { markerStart }),
            data: {
              ...d,
              connectorType: "default",
              flowDirection: (d.flowDirection as string) || "mono" as const,
              strokeColor: (d.strokeColor as string) || STROKE_COLORS[idx % STROKE_COLORS.length],
              ...(isDense && { strokeWidth: 1.5 }),
              ...(markerEnd !== undefined && { markerEnd }),
              ...(markerStart !== undefined && { markerStart }),
            },
          };
        });
      }

      // Apply grouping from LLM metadata: create group nodes and set parentId + extent: "parent"
      // on every child so nodes cannot be dragged outside the group until ungrouped (⌘⇧G).
      if (!isMindMapDiagram && groupMetadata.length > 0) {
        const withGroups = applyGroupingFromMetadata(layoutedNodes, groupMetadata);
        layoutedNodes = fitGroupBoundsAndCenterChildren(withGroups);
        // Run layout again so compound graph has proper alignment and gaps between groups
        const afterGroupLayout = await getLayoutedElements(
          layoutedNodes,
          layoutedEdges,
          direction,
          spacing,
          layoutAlgorithm
        );
        layoutedNodes = afterGroupLayout.nodes;
        layoutedEdges = afterGroupLayout.edges;
        // Layout children inside each group with proper padding and extent
        layoutedNodes = await layoutChildrenInsideGroups(
          layoutedNodes,
          layoutedEdges,
          direction,
          [40, 32]
        );
        layoutedNodes = ensureExtentForGroupedNodes(layoutedNodes);
      }

      // Apply layout (ELK) for alignment — for mind map or when diagram type is "any" (auto).
      // if ((isMindMapDiagram || diagramType === "auto") && !(groupMetadata.length > 0)) {
      //   const afterCollisionLayout = await getLayoutedElements(
      //     layoutedNodes,
      //     layoutedEdges,
      //     direction,
      //     spacing,
      //     layoutAlgorithm
      //   );
      //   layoutedNodes = afterCollisionLayout.nodes;
      //   layoutedEdges = afterCollisionLayout.edges;
      //   if (!isMindMapDiagram && layoutedNodes.some((n: { type?: string }) => n.type === "group")) {
      //     layoutedNodes = fitGroupBoundsAndCenterChildren(layoutedNodes);
      //   }
      // }

      // Ensure mind map edges use labeledConnector and correct handles.
      if (isMindMapDiagram && layoutedNodes.length > 0) {
        layoutedEdges = normalizeMindMapEdgeHandles(
          layoutedNodes,
          layoutedEdges,
          direction
        );
        layoutedEdges = layoutedEdges.map((edge: { id: string; source: string; target: string; type?: string; data?: Record<string, unknown> }) => {
          const srcNode = layoutedNodes.find((n: { id: string; type?: string }) => n.id === edge.source);
          const tgtNode = layoutedNodes.find((n: { id: string; type?: string }) => n.id === edge.target);
          const isMindMapEdge =
            srcNode?.type === "mindMap" && tgtNode?.type === "mindMap";
          return {
            ...edge,
            id: edge.id,
            type: isMindMapEdge ? "labeledConnector" : edge.type,
            data: { ...edge.data, connectorType: "default" },
          };
        });
      }

      // Mindmap-refine: only add new children under the focused node, then re-layout the full mind map.
      if (
        mode === "mindmap-refine" &&
        focusNodeId &&
        (canvasNodes?.length > 0 || canvasEdges?.length > 0)
      ) {
        const existingNodes = Array.isArray(canvasNodes) ? canvasNodes : [];
        const existingEdges = Array.isArray(canvasEdges) ? canvasEdges : [];
        const existingIds = new Set(
          existingNodes.map((n: { id: string }) => n.id)
        );

        // Treat AI output as suggestions for NEW nodes; we decide structure:
        // every new node becomes a direct child of the focused node.
        const newNodes = layoutedNodes.filter(
          (n) => !existingIds.has(n.id)
        );
        const newNodeIds = new Set(newNodes.map((n) => n.id));
        const refineRunId = `refine-${Date.now().toString(36)}`;
        const newEdges = newNodes.map((n, index) => ({
          id: `${refineRunId}-e-${index}-${focusNodeId}-${n.id}`,
          source: focusNodeId,
          target: n.id,
          type: "labeledConnector" as const,
          data: { connectorType: "default" as const },
        }));

        const mergedNodes = [...existingNodes, ...newNodes];
        // Remove any old edges that targeted these new nodes, so they don't get chained
        const cleanedExistingEdges = existingEdges.filter(
          (e) => !newNodeIds.has(e.target)
        );
        const mergedEdges = [...cleanedExistingEdges, ...newEdges];

        const mergedDirection: LayoutDirection =
          (mindMapLayout?.direction as LayoutDirection) ?? "LR";
        const mergedSpacing: [number, number] = [
          mindMapLayout?.spacingX ?? 80,
          mindMapLayout?.spacingY ?? 60,
        ];

        const mergedLayout = await getLayoutedElements(
          mergedNodes,
          mergedEdges,
          mergedDirection,
          mergedSpacing,
          (mindMapLayout?.algorithm as LayoutAlgorithm) ?? "elk-mrtree"
        );

        const refinedEdges = normalizeMindMapEdgeHandles(
          mergedLayout.nodes,
          mergedLayout.edges.map((edge) => {
            const src = mergedLayout.nodes.find((n) => n.id === edge.source);
            const tgt = mergedLayout.nodes.find((n) => n.id === edge.target);
            return {
              ...edge,
              type:
                src?.type === "mindMap" && tgt?.type === "mindMap"
                  ? "labeledConnector"
                  : edge.type,
              data: { ...edge.data, connectorType: "default" },
            };
          }),
          mergedDirection
        );

        // Apply layout (ELK) for alignment.
        const refineLayoutAgain = await getLayoutedElements(
          mergedLayout.nodes,
          refinedEdges,
          mergedDirection,
          mergedSpacing,
          (mindMapLayout?.algorithm as LayoutAlgorithm) ?? "elk-mrtree"
        );
        const refinedEdgesAfterLayout = normalizeMindMapEdgeHandles(
          refineLayoutAgain.nodes,
          refineLayoutAgain.edges.map((edge) => {
            const src = refineLayoutAgain.nodes.find((n) => n.id === edge.source);
            const tgt = refineLayoutAgain.nodes.find((n) => n.id === edge.target);
            return {
              ...edge,
              type: src?.type === "mindMap" && tgt?.type === "mindMap" ? "labeledConnector" : edge.type,
              data: { ...edge.data, connectorType: "default" },
            };
          }),
          mergedDirection
        );
        const refinedResolved = resolveCollisionsWithGroups(
          ensureExtentForGroupedNodes(refineLayoutAgain.nodes),
          { margin: 24, maxIterations: 150, overlapThreshold: 0 }
        );
        await applyLayoutWithAnimation(
          setNodes,
          setEdges,
          refinedResolved,
          refinedEdgesAfterLayout,
          existingNodes,
          applyAnimatedLayout
        );
        setPendingFitViewNodeIds(refinedResolved.map((n: { id: string }) => n.id));
        await syncDiagramToExcalidraw(refinedResolved, refinedEdgesAfterLayout);
      } else if (mode === "mindmap-refine") {
        const mindmapResolved = resolveCollisionsWithGroups(
          ensureExtentForGroupedNodes(layoutedNodes),
          { margin: 24, maxIterations: 150, overlapThreshold: 0 }
        );
        const currentForAnim = Array.isArray(canvasNodes) ? canvasNodes : [];
        await applyLayoutWithAnimation(
          setNodes,
          setEdges,
          mindmapResolved,
          layoutedEdges,
          currentForAnim,
          applyAnimatedLayout
        );
        setPendingFitViewNodeIds(mindmapResolved.map((n: { id: string }) => n.id));
        await syncDiagramToExcalidraw(mindmapResolved, layoutedEdges);
      } else {
        // ─── Keep existing nodes, add AI nodes alongside them ─────────
        if (existingNodes.length > 0 && canvasBounds) {
          // Compute bounding box of the new AI-generated nodes
          let aiMinX = Infinity, aiMinY = Infinity;
          for (const n of layoutedNodes) {
            const x = n.position?.x ?? 0;
            const y = n.position?.y ?? 0;
            if (x < aiMinX) aiMinX = x;
            if (y < aiMinY) aiMinY = y;
          }

          // Offset all AI nodes so their top-left starts below existing content
          // with a generous gap (400px below the lowest existing node).
          const GAP = 400;
          const offsetX = canvasBounds.minX - aiMinX; // align left edges
          const offsetY = (canvasBounds.maxY + GAP) - aiMinY; // place below

          const offsetNodes = layoutedNodes.map((n: { id: string; position: { x: number; y: number }; parentId?: string; [k: string]: unknown }) => {
            // Don't offset children inside groups — they use relative positions
            if (n.parentId) return n;
            return {
              ...n,
              position: {
                x: n.position.x + offsetX,
                y: n.position.y + offsetY,
              },
            };
          });
          const offsetResolved = resolveCollisionsWithGroups(offsetNodes as Node[], {
            margin: 24,
            maxIterations: 150,
            overlapThreshold: 0,
          });
          const mergedNodes: Node[] = [...(existingNodes as Node[]), ...(offsetResolved as Node[])];
          const mergedEdges: Edge[] = [...(existingEdges as Edge[]), ...(layoutedEdges as Edge[])];
          await applyNodesAndEdgesInChunks(setNodes, setEdges, mergedNodes, mergedEdges);
          setPendingFitViewNodeIds(offsetResolved.map((n: { id: string }) => n.id));
          await syncDiagramToExcalidraw(mergedNodes, mergedEdges);
        } else {
          // Canvas is empty — use same collision resolution as "Layout all" so result looks good
          const emptyResolved = resolveCollisionsWithGroups(
            ensureExtentForGroupedNodes(layoutedNodes),
            { margin: 24, maxIterations: 150, overlapThreshold: 0 }
          );
          const currentForAnim = Array.isArray(canvasNodes) ? canvasNodes : [];
          await applyLayoutWithAnimation(
            setNodes,
            setEdges,
            emptyResolved,
            layoutedEdges,
            currentForAnim,
            applyAnimatedLayout
          );
          setPendingFitViewNodeIds(emptyResolved.map((n: { id: string }) => n.id));
          await syncDiagramToExcalidraw(emptyResolved, layoutedEdges);
        }
      }

      setLastAIPrompt(effectivePrompt.trim());
      setLastAIDiagram({ nodes: layoutedNodes, edges: layoutedEdges });

      // Save generated React Flow diagram to preset in DB for future loads
      if (preset !== "none" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(preset)) {
        const stripRefId = (id: string) => (refId && id.startsWith(`${refId}-`) ? id.slice(refId.length + 1) : id);
        const nodesForPreset = layoutedNodes.map((n: { id: string; [k: string]: unknown }) => ({
          ...n,
          id: stripRefId(n.id),
          parentId: n.parentId ? stripRefId(String(n.parentId)) : undefined,
        }));
        const edgesForPreset = layoutedEdges.map((e: { id: string; source: string; target: string; [k: string]: unknown }) => ({
          ...e,
          id: stripRefId(e.id),
          source: stripRefId(e.source),
          target: stripRefId(e.target),
        }));
        fetch(`/api/presets/${preset}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ nodes: nodesForPreset, edges: edgesForPreset }),
        }).catch(() => {});
      }

      // Persist so the canvas shows the generated diagram (both Diagram and Excalidraw canvases).
      saveNow();
      // Record prompt + diagram (use applied state from store)
      const applied = useCanvasStore.getState();
      recordPromptHistory({
        prompt: effectivePrompt.trim(),
        nodes: applied.nodes as object[],
        edges: applied.edges as object[],
        targetCanvas: "reactflow",
      });

      // If user was in Excalidraw mode, switch view so they see the result there.
      if (targetCanvasMode === "excalidraw") setCanvasMode("excalidraw");

      // Fit diagram into view. Stay on ai-diagram page; user closes to go back to editor.
      setPendingFitView(true);
    } catch (err) {
      useCanvasStore.getState().setExcalidrawGenerating(false);
      const msg = err instanceof Error ? err.message : "Something went wrong";
      // For API-key-related errors, provide a friendlier message
      if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("no api key")) {
        setError("No API key configured. Add your key in Settings → Integration to use AI generation.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setStreamingText("");
    }
  };

  return (
    <>
      {/* Main editor canvas */}
      <EditorLayout />

      {/* Side AI panel docked on the right; canvas remains visible and interactive on the left */}
      <div className="fixed inset-y-0 right-0 z-40 flex pointer-events-none">
        <div className="pointer-events-auto w-[360px] max-w-full h-full bg-white border-l border-gray-200 shadow-xl flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              AI Diagram Generator
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => useCanvasStore.getState().setSettingsOpen(true, "integration")}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="AI integration settings (model, API key)"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => router.push("/editor")}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 flex flex-col gap-3 overflow-auto">
            {mode === "mindmap-refine" && (focusNode || focusNodeLabelFromQuery) && (
              <div className="border border-violet-100 bg-violet-50/60 rounded-lg px-3 py-2">
                <p className="text-[11px] font-semibold text-violet-900 mb-0.5">
                  Refining topic:
                </p>
                <p className="text-xs text-violet-800 font-medium">
                  {(focusNode?.data?.label as string) ||
                    focusNodeLabelFromQuery ||
                    focusNodeId}
                </p>
              </div>
            )}
            {hasSelectionContext && (
              <div className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[11px] font-semibold text-gray-700">
                    Context (selected on canvas):
                  </p>
                  <button
                    type="button"
                    onClick={clearNodeContext}
                    className="text-[11px] font-medium text-violet-600 hover:text-violet-800 whitespace-nowrap"
                  >
                    Clear selection
                  </button>
                </div>
                <ul className="text-xs text-gray-800 space-y-0.5">
                  {selectedNodes.slice(0, 5).map((n: any) => (
                    <li key={n.id} className="font-medium">
                      {(n.data?.label as string) || n.type || n.id}
                      {n.type && n.type !== "default" && (
                        <span className="text-gray-500 font-normal ml-1">({n.type})</span>
                      )}
                    </li>
                  ))}
                  {selectedNodes.length > 5 && (
                    <li className="text-gray-500">+{selectedNodes.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
            {mode !== "mindmap-refine" && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-700 block">
                  Generate for
                </label>
                <select
                  value={targetCanvas}
                  onChange={(e) => {
                    const v = e.target.value as "reactflow" | "excalidraw" | "drawio";
                    setTargetCanvas(v);
                    setCanvasMode(v);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="reactflow">Diagram (React Flow)</option>
                  <option value="excalidraw">Excalidraw</option>
                  <option value="drawio">Draw.io</option>
                </select>
              </div>
            )}
            {targetCanvas === "excalidraw" && mode !== "mindmap-refine" && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-700 block">
                  Excalidraw mode
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExcalidrawMode("json")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      excalidrawMode === "json"
                        ? "bg-violet-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    disabled={loading}
                  >
                    J2 DSL
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcalidrawMode("mermaid")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      excalidrawMode === "mermaid"
                        ? "bg-violet-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    disabled={loading}
                  >
                    Mermaid
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">
                  {excalidrawMode === "json"
                    ? "LLM generates J2 DSL (compact format) → converted to Excalidraw."
                    : "LLM generates Mermaid code (flowchart, sequence, class) → converted to Excalidraw."}
                </p>
              </div>
            )}
            {targetCanvas === "excalidraw" && mode !== "mindmap-refine" && (
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-700 block">
                  Mode
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAiMode("generate")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      aiMode === "generate"
                        ? "bg-violet-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    disabled={loading}
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiMode("refine")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      aiMode === "refine"
                        ? "bg-violet-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    disabled={loading}
                  >
                    Refine
                  </button>
                </div>
                {aiMode === "refine" && (
                  <p className="text-[10px] text-gray-500">
                    {Array.isArray(excalidrawData?.elements) && excalidrawData.elements.length > 0
                      ? `Extend or improve the current diagram (${excalidrawData.elements.length} elements).`
                      : "Switch to Excalidraw and add content first, or use Generate for a new diagram."}
                  </p>
                )}
              </div>
            )}
            {mode !== "mindmap-refine" && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-700 block">
                    Load a preset
                  </label>
                  <div className="flex items-center gap-2">
                    {presetLoading && (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400 shrink-0" aria-hidden />
                    )}
                    <select
                      value={preset}
                      disabled={loading || presetLoading}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPreset(v);
                        setPresetSource("cache");
                        if (v !== "none" && error === "signup-or-key") setError(null);
                        const p = presetOptions.find((x) => x.value === v);
                        if (p) {
                          setPrompt(p.prompt);
                          if (p.targetCanvas) {
                            setTargetCanvas(p.targetCanvas);
                            setCanvasMode(p.targetCanvas);
                          }
                        }
                      }}
                      className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    >
                      {presetOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {preset !== "none" && (() => {
                      const p = presetOptions.find((x) => x.value === preset);
                      const imgUrl = p?.previewImageUrl && (p.previewImageUrl.startsWith("http://") || p.previewImageUrl.startsWith("https://"))
                        ? p.previewImageUrl
                        : null;
                      return imgUrl ? (
                        <img
                          src={imgUrl}
                          alt=""
                          className="w-8 h-8 object-contain rounded border border-gray-200 shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] text-gray-500">Use:</span>
                    <div className="flex rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-800 dark:border-gray-600 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => { setPresetSource("cache"); if (error?.includes("No saved diagram")) setError(null); }}
                        className={cn(
                          "px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                          presetSource === "cache"
                            ? "bg-violet-600 text-white dark:bg-violet-500"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                      >
                        Load saved
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPresetSource("ai"); if (error?.includes("No saved diagram")) setError(null); }}
                        className={cn(
                          "px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                          presetSource === "ai"
                            ? "bg-violet-600 text-white dark:bg-violet-500"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                      >
                        Generate with AI
                      </button>
                    </div>
                  </div>
                </div>
                {targetCanvas === "reactflow" && mode !== "mindmap-refine" && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-gray-700 block">
                      Diagram type
                    </label>
                    <select
                      value={diagramType}
                      onChange={(e) => setDiagramType(e.target.value as DiagramTypeValue)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      disabled={loading}
                    >
                      {DIAGRAM_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
            {targetCanvas === "excalidraw" && (
              <p className="text-[11px] text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 rounded-lg px-2.5 py-1.5">
                {excalidrawMode === "mermaid"
                  ? "Mermaid: LLM generates Mermaid code → converted to Excalidraw. Prompts: &quot;user login flowchart&quot;, &quot;API request sequence&quot;, &quot;class diagram for e-commerce&quot;."
                  : "J2 DSL: LLM generates compact DSL (rect, ellipse, startBind/endBind) → converted to Excalidraw. Prompts: &quot;flowchart for user login&quot;, &quot;architecture diagram&quot;, &quot;system design&quot;."}
              </p>
            )}
            {targetCanvas === "drawio" && (
              <p className="text-[11px] text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 rounded-lg px-2.5 py-1.5">
                Draw.io (dedicated AI). Flowcharts, architecture, process flows, UML. Output is Draw.io mxGraph format.
              </p>
            )}
            <p className="text-xs text-gray-500">
              {mode === "mindmap-refine"
                ? "Describe what new ideas, children or siblings you want to add for this mind map node."
                : "Describe your diagram and we'll create it. Presets work without sign-in; for your own description, sign up or add your API key in Settings."}
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                mode === "mindmap-refine"
                  ? "e.g. Add 5 more specific sub-ideas for this topic, grouped by implementation steps..."
                  : "e.g. Web app architecture with client, API gateway, services, and databases..."
              }
              className="w-full h-28 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-sm"
              disabled={loading}
            />
            {/* Current model + API key status */}
            <ModelStatusBadge />
            {/* Live LLM response at bottom of panel during generation */}
            {(loading || streamingText) && (
              <div className="flex flex-col gap-1 shrink-0">
                <p className="text-[11px] font-semibold text-gray-500">
                  {streamingText ? "Receiving response…" : "Waiting for response…"}
                </p>
                <div className="bg-gray-900 text-gray-100 rounded-lg p-2.5 max-h-36 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap break-words">
                  {streamingText || "\u00A0"}
                  <div ref={streamEndRef} />
                </div>
              </div>
            )}
            {error && (
              error === "signup-or-key" ? (
                <div className="flex flex-col gap-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <p className="font-medium">Custom AI needs sign-in or your own API key</p>
                  <p className="text-amber-700">Presets work without signing in. To generate from your own description, sign up to use credits or add your API key in Settings.</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Link
                      href="/sign-up"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-violet-600 text-white font-medium hover:bg-violet-500"
                    >
                      Sign up to use AI
                    </Link>
                    <button
                      type="button"
                      onClick={() => useCanvasStore.getState().setSettingsOpen(true, "integration")}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-amber-300 text-amber-800 hover:bg-amber-100"
                    >
                      Add API key in Settings
                    </button>
                  </div>
                </div>
              ) : error.toLowerCase().includes("api key") ? (
                <button
                  type="button"
                  onClick={() => useCanvasStore.getState().setSettingsOpen(true, "integration")}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs hover:bg-amber-100 transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>No API key configured. Click here to add your key in Settings for AI features.</span>
                </button>
              ) : (
                <p className="text-xs text-red-600">{error}</p>
              )
            )}
            <div className="mt-auto flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => router.push("/editor")}
                className="px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 flex items-center gap-2 text-xs"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Generate
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
