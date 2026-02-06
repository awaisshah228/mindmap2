"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import type { Node, Edge } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  getLayoutedElements,
  normalizeMindMapEdgeHandles,
  fitGroupBoundsAndCenterChildren,
  applyGroupingFromMetadata,
  layoutChildrenInsideGroups,
  ensureExtentForGroupedNodes,
  type LayoutDirection,
  type LayoutAlgorithm,
} from "@/lib/layout-engine";
import { buildSystemPrompt, buildUserMessage, getMindMapStructure, type CanvasBounds } from "@/lib/ai/prompt-builder";
import { streamDiagramGeneration } from "@/lib/ai/frontend-ai";
import EditorLayout from "@/components/layout/EditorLayout";
import { saveNow } from "@/lib/store/project-storage";
import { Loader2, Settings } from "lucide-react";
import { applyNodesAndEdgesInChunks } from "@/lib/chunked-nodes";
import { parseStreamingDiagramBuffer, parseStreamingElementsBuffer } from "@/lib/ai/streaming-json-parser";
import { diagramToExcalidraw } from "@/lib/excalidraw-convert";
import { excalidrawToDrawioXml } from "@/lib/excalidraw-to-drawio";
import { normalizeSkeletons } from "@/lib/skeleton-normalize";

export const DIAGRAM_TYPE_OPTIONS = [
  { value: "auto", label: "Auto detect (default)" },
  { value: "mindmap", label: "Mind map" },
  { value: "architecture", label: "Cloud / System architecture" },
  { value: "flowchart", label: "Flowchart" },
  { value: "sequence", label: "Sequence" },
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

const DEFAULT_PRESET_OPTIONS: PresetOption[] = [
  { value: "none", label: "None (default)", prompt: "" },
];

/** Draw.io prompt presets (client-side; no pre-built diagram). */
const DRAWIO_PRESETS: PresetOption[] = [
  { value: "drawio-flowchart", label: "Draw.io: Flowchart", prompt: "Create a flowchart for a typical user login process: start, input credentials, validate, success or error, redirect.", targetCanvas: "drawio" },
  { value: "drawio-architecture", label: "Draw.io: System architecture", prompt: "Create a system architecture diagram: client, API gateway, backend services, database. Use clear boxes and arrows.", targetCanvas: "drawio" },
  { value: "drawio-process-flow", label: "Draw.io: Process flow", prompt: "Create a business process flow: receive order, validate, payment, fulfillment, shipping, delivery.", targetCanvas: "drawio" },
  { value: "drawio-uml", label: "Draw.io: UML class diagram", prompt: "Create a UML class diagram for an e-commerce domain: User, Order, Product, Cart, Payment classes with relationships.", targetCanvas: "drawio" },
  { value: "drawio-network", label: "Draw.io: Network diagram", prompt: "Create a network diagram: router, switches, servers, firewall. Show connections and subnets.", targetCanvas: "drawio" },
];

/** Excalidraw prompt presets (client-side; no pre-built diagram). */
const EXCALIDRAW_PRESETS: PresetOption[] = [
  { value: "excalidraw-flowchart", label: "Excalidraw: Flowchart", prompt: "Create a simple flowchart: start, steps, decision diamond, end. Use boxes and arrows.", targetCanvas: "excalidraw" },
  { value: "excalidraw-architecture", label: "Excalidraw: Architecture", prompt: "Create an architecture diagram: Frontend, API, Database, Cache. Use rectangles and connecting arrows.", targetCanvas: "excalidraw" },
  { value: "excalidraw-mindmap", label: "Excalidraw: Mind map", prompt: "Create a mind map with a central topic and 4-6 branches. Use boxes and curved connectors.", targetCanvas: "excalidraw" },
  { value: "excalidraw-wireframe", label: "Excalidraw: Wireframe", prompt: "Create a simple app wireframe: header, sidebar, main content area, footer.", targetCanvas: "excalidraw" },
  { value: "excalidraw-sequence", label: "Excalidraw: Sequence", prompt: "Create a sequence diagram: User, Frontend, API, Database. Show request/response arrows.", targetCanvas: "excalidraw" },
];

/** Small badge showing current model + API key status below the prompt textarea. */
function ModelStatusBadge() {
  const llmProvider = useCanvasStore((s) => s.llmProvider);
  const llmModel = useCanvasStore((s) => s.llmModel);
  const llmApiKey = useCanvasStore((s) => s.llmApiKey);
  const hasKey = Boolean(llmApiKey);

  const providerLabel =
    llmProvider === "openai" ? "OpenAI"
    : llmProvider === "anthropic" ? "Anthropic"
    : llmProvider === "google" ? "Google"
    : llmProvider === "openrouter" ? "OpenRouter"
    : "Custom";

  // Shorten model name for display
  const modelShort = llmModel.length > 28 ? llmModel.slice(0, 26) + "…" : llmModel;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => useCanvasStore.getState().setSettingsOpen(true, "integration")}
        className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
        title="Click to change AI model or API key"
      >
        <span className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${hasKey ? "bg-green-500" : "bg-amber-400"}`} />
          {providerLabel}
        </span>
        <span className="text-gray-300">·</span>
        <span className="font-mono truncate max-w-[180px]">{modelShort}</span>
        <span className="text-gray-300">·</span>
        <span>{hasKey ? "Own key" : "Server API"}</span>
      </button>
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
  const [apiPresets, setApiPresets] = useState<PresetOption[]>([]);
  /** Target canvas for AI generation: diagram (React Flow), excalidraw, or drawio. */
  const [targetCanvas, setTargetCanvas] = useState<"reactflow" | "excalidraw" | "drawio">("reactflow");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/presets")
      .then((r) => r.ok ? r.json() : [])
      .then((list: { id: string; label: string; prompt?: string; previewImageUrl?: string }[]) => {
        setApiPresets(
          list.map((p) => ({ value: p.id, label: p.label, prompt: p.prompt ?? "", previewImageUrl: p.previewImageUrl }))
        );
      })
      .catch(() => {});
  }, []);

  const presetOptions: PresetOption[] =
    targetCanvas === "drawio"
      ? [{ value: "none", label: "None (default)", prompt: "" }, ...DRAWIO_PRESETS]
      : targetCanvas === "excalidraw"
        ? [{ value: "none", label: "None (default)", prompt: "" }, ...EXCALIDRAW_PRESETS]
        : [{ value: "none", label: "None (default)", prompt: "" }, ...apiPresets];

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
    setDrawioData,
    setHasUnsavedChanges,
  } = useCanvasStore() as any;

  // Sync target canvas from current tab when landing on AI page
  useEffect(() => {
    setTargetCanvas(canvasMode);
  }, [canvasMode]);

  // Reset preset when target canvas changes (preset options differ per canvas)
  const prevTargetCanvas = useRef<"reactflow" | "excalidraw" | "drawio">(targetCanvas);
  useEffect(() => {
    if (prevTargetCanvas.current !== targetCanvas) {
      prevTargetCanvas.current = targetCanvas;
      setPreset("none");
    }
  }, [targetCanvas]);

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
    const effectivePrompt = preset !== "none"
      ? (selectedPreset?.prompt ?? prompt)
      : prompt;
    if (!effectivePrompt.trim()) return;
    setLoading(true);
    setError(null);
    const effectiveTarget =
      preset !== "none" && selectedPreset?.targetCanvas
        ? selectedPreset.targetCanvas
        : preset !== "none"
          ? "reactflow"
          : targetCanvas;
    const targetCanvasMode = effectiveTarget;

    try {
      // Read LLM settings from store
      const { llmProvider, llmModel, llmApiKey, llmBaseUrl } = useCanvasStore.getState();

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
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamBuffer += decoder.decode(value, { stream: true });
          const parsed = parseStreamingElementsBuffer(streamBuffer);
          if (parsed.elements.length > lastElementCount) {
            const normalized = normalizeSkeletons(parsed.elements);
            const xml = excalidrawToDrawioXml(normalized as Parameters<typeof excalidrawToDrawioXml>[0]);
            setDrawioData(xml);
            setCanvasMode("drawio");
            lastElementCount = parsed.elements.length;
          }
        }
        const finalParsed = parseStreamingElementsBuffer(streamBuffer);
        if (finalParsed.elements.length === 0) {
          setError("AI returned no elements. Try a different prompt.");
          setLoading(false);
          return;
        }
        const normalized = normalizeSkeletons(finalParsed.elements);
        const xml = excalidrawToDrawioXml(normalized as Parameters<typeof excalidrawToDrawioXml>[0]);
        setDrawioData(xml);
        setCanvasMode("drawio");
        setHasUnsavedChanges(true);
        setLastAIPrompt(effectivePrompt.trim());
        setLastAIDiagram(null);
        saveNow();
        setPendingFitView(true);
        setLoading(false);
        return;
      }

      // ─── Excalidraw: streaming generation ───
      if (effectiveTarget === "excalidraw") {
        if (!llmApiKey && !isSignedIn) {
          setLoading(false);
          setError("signup-or-key");
          return;
        }
        const res = await fetch("/api/diagrams/generate-excalidraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            prompt: effectivePrompt.trim(),
            llmProvider,
            llmModel,
            llmApiKey: llmApiKey || undefined,
          }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error ?? "Failed to generate Excalidraw diagram");
        }
        if (!res.body) throw new Error("No response body");
        const decoder = new TextDecoder();
        let streamBuffer = "";
        let lastElementCount = 0;
        const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          streamBuffer += decoder.decode(value, { stream: true });
          const parsed = parseStreamingElementsBuffer(streamBuffer);
          if (parsed.elements.length > lastElementCount) {
            const normalized = normalizeSkeletons(parsed.elements);
            const elements = convertToExcalidrawElements(normalized as never[], { regenerateIds: false });
            setExcalidrawData({ elements, appState: {} });
            setCanvasMode("excalidraw");
            lastElementCount = parsed.elements.length;
          }
        }
        const finalParsed = parseStreamingElementsBuffer(streamBuffer);
        if (finalParsed.elements.length === 0) {
          setError("AI returned no elements. Try a different prompt.");
          setLoading(false);
          return;
        }
        const normalized = normalizeSkeletons(finalParsed.elements);
        const elements = convertToExcalidrawElements(normalized as never[], { regenerateIds: false });
        setExcalidrawData({ elements, appState: {} });
        setCanvasMode("excalidraw");
        setHasUnsavedChanges(true);
        setLastAIPrompt(effectivePrompt.trim());
        setLastAIDiagram(null);
        saveNow();
        setPendingFitView(true);
        setLoading(false);
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

      // ─── Preset: stream response so we render nodes/edges in sequence (in chunks) ──
      const nodeIdMap = new Map<string, string>();
      if (preset !== "none") {
        const presetRes = await fetch(
          `/api/diagrams/preset/stream?preset=${encodeURIComponent(preset)}`,
          { credentials: "include" }
        );
        if (!presetRes.ok || !presetRes.body) {
          const errBody = await presetRes.text().catch(() => "");
          let errMsg = "Failed to load preset";
          try {
            const j = JSON.parse(errBody);
            if (j?.error) errMsg = String(j.error);
          } catch {
            if (presetRes.status === 404) errMsg = "Preset not found";
          }
          setError(errMsg);
          setLoading(false);
          return;
        }
        {
          let full = "";
          let streamBuffer = "";
          let streamedNodeCount = 0;
          let streamedEdgeCount = 0;

          const processStreamChunk = (delta: string) => {
            streamBuffer += delta;
            const res = parseStreamingDiagramBuffer(streamBuffer);
            const store = useCanvasStore.getState();
            const setNodesNow = store.setNodes;
            const setEdgesNow = store.setEdges;

            for (let i = streamedNodeCount; i < res.nodes.length; i++) {
              const raw = res.nodes[i] as { id: string; type?: string; parentId?: string; [k: string]: unknown };
              if (raw.type === "group") continue;
              const newId = refId ? `${refId}-${raw.id}` : raw.id;
              const newParentId = raw.parentId && refId ? `${refId}-${raw.parentId}` : raw.parentId;
              nodeIdMap.set(raw.id, newId);
              const node: Node = {
                id: newId,
                type: (raw.type as string) || "rectangle",
                position: (raw.position as { x: number; y: number }) ?? { x: 0, y: 0 },
                data: (raw.data as Record<string, unknown>) ?? {},
                ...(newParentId && { parentId: newParentId, extent: "parent" as const }),
              };
              if (streamedNodeCount === 0 && i === 0 && isNewDiagram) {
                setNodesNow([node]);
                setEdgesNow([]);
              } else {
                setNodesNow((prev) => (prev.some((n) => n.id === node.id) ? prev : [...prev, node]));
              }
            }
            streamedNodeCount = res.nodes.length;

            for (let i = streamedEdgeCount; i < res.edges.length; i++) {
              const raw = res.edges[i] as { id?: string; source: string; target: string; [k: string]: unknown };
              const source = nodeIdMap.get(raw.source) ?? raw.source;
              const target = nodeIdMap.get(raw.target) ?? raw.target;
              const edge: Edge = {
                id: raw.id ? (refId ? `${refId}-${raw.id}` : raw.id) : `e-${source}-${target}-${i}`,
                source,
                target,
                ...(raw.data != null && typeof raw.data === "object" && !Array.isArray(raw.data)
                  ? { data: raw.data as Record<string, unknown> }
                  : {}),
              };
              setEdgesNow((prev) => (prev.some((e) => e.id === edge.id) ? prev : [...prev, edge]));
            }
            streamedEdgeCount = res.edges.length;
          };

          const reader = presetRes.body.getReader();
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

          try {
            parsed = JSON.parse(full.trim()) as Record<string, unknown>;
          } catch {
            setError("Preset returned invalid JSON");
            setLoading(false);
            return;
          }
          // If preset has no pre-built diagram, fall through to LLM with preset's prompt
          const presetNodes = parsed?.nodes;
          if (Array.isArray(presetNodes) && presetNodes.length === 0) {
            parsed = null;
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
      if (!parsed) {
        let full = "";
        let streamBuffer = "";
        let streamedNodeCount = 0;
        let streamedEdgeCount = 0;

        const processStreamChunk = (delta: string) => {
          streamBuffer += delta;
          const res = parseStreamingDiagramBuffer(streamBuffer);
          const store = useCanvasStore.getState();
          const setNodesNow = store.setNodes;
          const setEdgesNow = store.setEdges;

          for (let i = streamedNodeCount; i < res.nodes.length; i++) {
            const raw = res.nodes[i] as { id: string; type?: string; parentId?: string; [k: string]: unknown };
            if (raw.type === "group") continue;
            const newId = refId ? `${refId}-${raw.id}` : raw.id;
            const newParentId = raw.parentId && refId ? `${refId}-${raw.parentId}` : raw.parentId;
            nodeIdMap.set(raw.id, newId);
            const node: Node = {
              id: newId,
              type: (raw.type as string) || "rectangle",
              position: (raw.position as { x: number; y: number }) ?? { x: 0, y: 0 },
              data: (raw.data as Record<string, unknown>) ?? {},
              ...(newParentId && { parentId: newParentId, extent: "parent" as const }),
            };
            if (streamedNodeCount === 0 && i === 0 && isNewDiagram) {
              setNodesNow([node]);
              setEdgesNow([]);
            } else {
              setNodesNow((prev) => (prev.some((n) => n.id === node.id) ? prev : [...prev, node]));
            }
          }
          streamedNodeCount = res.nodes.length;

          for (let i = streamedEdgeCount; i < res.edges.length; i++) {
            const raw = res.edges[i] as { id?: string; source: string; target: string; [k: string]: unknown };
            const source = nodeIdMap.get(raw.source) ?? raw.source;
            const target = nodeIdMap.get(raw.target) ?? raw.target;
            const edge: Edge = {
              id: raw.id ? (refId ? `${refId}-${raw.id}` : raw.id) : `e-${source}-${target}-${i}`,
              source,
              target,
              ...(raw.data != null && typeof raw.data === "object" && !Array.isArray(raw.data)
                ? { data: raw.data as Record<string, unknown> }
                : {}),
            };
            setEdgesNow((prev) => (prev.some((e) => e.id === edge.id) ? prev : [...prev, edge]));
          }
          streamedEdgeCount = res.edges.length;
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
            onChunk: processStreamChunk,
          });
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
              processStreamChunk(chunk);
            }
          }
          full += decoder.decode();
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
      // Only flat nodes: LLM returns groups as metadata (groups array), not as group nodes.
      let safeNodes = Array.isArray(nodes)
        ? (nodes as { id: string; type?: string; [k: string]: unknown }[]).filter((n) => n.type !== "group")
        : [];
      let rawEdges = Array.isArray(edges) ? edges : [];
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
          .map(
            (
              e: {
                id: string;
                source: string;
                target: string;
                sourceHandle?: string;
                targetHandle?: string;
                data?: Record<string, unknown>;
              },
              index: number
            ) => ({
              ...e,
              id: `${refId}-e-${index}-${e.source}-${e.target}`,
              source: nodeIdMap.get(e.source) ?? e.source,
              target: nodeIdMap.get(e.target) ?? e.target,
            })
          );
        const nodeIdsSet = new Set(safeNodes.map((n: { id: string }) => n.id));
        groupMetadata = groupMetadata
          .map((g) => ({
            id: `${refId}-${g.id}`,
            label: g.label,
            nodeIds: g.nodeIds.map((id) => nodeIdMap.get(id) ?? id).filter((id) => nodeIdsSet.has(id)),
          }))
          .filter((g) => g.nodeIds.length > 0);
      }

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
      const direction: LayoutDirection = isMindMapDiagram
        ? (mindMapLayout?.direction ?? "LR")
        : layoutDirection === "vertical"
          ? "TB"
          : "LR";
      const hasGroups = groupMetadata.length > 0;
      // Generous spacing when we have groups so flat layout has clear gaps; then we apply grouping and run layout again
      const spacing: [number, number] = isMindMapDiagram
        ? [mindMapLayout?.spacingX ?? 120, mindMapLayout?.spacingY ?? 100]
        : hasGroups
          ? [240, 200]
          : [160, 120];
      const layoutAlgorithm: LayoutAlgorithm = isMindMapDiagram
        ? (mindMapLayout?.algorithm ?? "elk-mrtree")
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
        await applyNodesAndEdgesInChunks(setNodes, setEdges, refineLayoutAgain.nodes, refinedEdgesAfterLayout);
        setPendingFitViewNodeIds(refineLayoutAgain.nodes.map((n: { id: string }) => n.id));
        await syncDiagramToExcalidraw(refineLayoutAgain.nodes, refinedEdgesAfterLayout);
      } else if (mode === "mindmap-refine") {
        await applyNodesAndEdgesInChunks(setNodes, setEdges, layoutedNodes, layoutedEdges);
        setPendingFitViewNodeIds(layoutedNodes.map((n: { id: string }) => n.id));
        await syncDiagramToExcalidraw(layoutedNodes, layoutedEdges);
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

          const mergedNodes: Node[] = [...(existingNodes as Node[]), ...(offsetNodes as Node[])];
          const mergedEdges: Edge[] = [...(existingEdges as Edge[]), ...(layoutedEdges as Edge[])];
          await applyNodesAndEdgesInChunks(setNodes, setEdges, mergedNodes, mergedEdges);
          setPendingFitViewNodeIds(offsetNodes.map((n: { id: string }) => n.id));
          await syncDiagramToExcalidraw(mergedNodes, mergedEdges);
        } else {
          // Canvas is empty — apply in chunks to avoid "Maximum call stack exceeded"
          await applyNodesAndEdgesInChunks(setNodes, setEdges, layoutedNodes, layoutedEdges);
          setPendingFitViewNodeIds(layoutedNodes.map((n: { id: string }) => n.id));
          await syncDiagramToExcalidraw(layoutedNodes, layoutedEdges);
        }
      }

      setLastAIPrompt(effectivePrompt.trim());
      setLastAIDiagram({ nodes: layoutedNodes, edges: layoutedEdges });

      // Persist so the canvas shows the generated diagram (both Diagram and Excalidraw canvases).
      saveNow();

      // If user was in Excalidraw mode, switch view so they see the result there.
      if (targetCanvasMode === "excalidraw") setCanvasMode("excalidraw");

      // Fit diagram into view. Stay on ai-diagram page; user closes to go back to editor.
      setPendingFitView(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      // For API-key-related errors, provide a friendlier message
      if (msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("no api key")) {
        setError("No API key configured. Add your key in Settings → Integration to use AI generation.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
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
                  onChange={(e) => setTargetCanvas(e.target.value as "reactflow" | "excalidraw" | "drawio")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="reactflow">Diagram (React Flow)</option>
                  <option value="excalidraw">Excalidraw</option>
                  <option value="drawio">Draw.io</option>
                </select>
              </div>
            )}
            {mode !== "mindmap-refine" && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-700 block">
                    Load a preset
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={preset}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPreset(v);
                        if (v !== "none" && error === "signup-or-key") setError(null);
                        const p = presetOptions.find((x) => x.value === v);
                        if (p) setPrompt(p.prompt);
                      }}
                      className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      disabled={loading}
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
                Generating for Excalidraw (shapes, arrows). Use prompts like &quot;flowchart for user login&quot;, &quot;simple architecture diagram&quot;, or &quot;mind map about project planning&quot;.
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
