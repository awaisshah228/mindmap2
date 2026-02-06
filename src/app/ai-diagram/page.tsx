"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Node, Edge } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  getLayoutedElements,
  normalizeMindMapEdgeHandles,
  fitGroupBoundsAndCenterChildren,
  applyGroupingFromMetadata,
  type LayoutDirection,
  type LayoutAlgorithm,
} from "@/lib/layout-engine";
import { buildSystemPrompt, buildUserMessage, type CanvasBounds } from "@/lib/ai/prompt-builder";
import { streamDiagramGeneration } from "@/lib/ai/frontend-ai";
import EditorLayout from "@/components/layout/EditorLayout";
import { saveNow } from "@/lib/store/project-storage";
import { Loader2, Settings } from "lucide-react";

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

export const DIAGRAM_PRESETS = [
  { value: "none", label: "None (default)", prompt: "" },
  { value: "ecommerce-mern-aws", label: "eCommerce MERN + AWS (full stack)", prompt: "Full-stack eCommerce architecture with MERN on AWS. Clear left-to-right flow, well-aligned nodes. Use only 2–4 groups if they help (e.g. Frontend, Backend, Data); do not add unnecessary groups. Include: User, React SPA (CloudFront + S3), ALB, Node.js/Express API (ECS Fargate), MongoDB Atlas, Redis (sessions/cart), AWS SQS (order queue), AWS SNS (notifications), Apache Kafka (events), Socket.io (real-time), S3 + CloudFront (images/CDN), Cognito/Auth0, Stripe, Elasticsearch. Label every edge (e.g. Requests, API calls, Queries, Pub/Sub, WebSockets, Events). Correct source/target and sourceHandle/targetHandle for clean connections. Use brand icons (AWS, MongoDB, Redis, Kafka, Stripe, React, Node)." },
  { value: "stripe-payment", label: "Stripe payment flow", prompt: "Create a flowchart for Stripe payment flow: user selects product, cart, checkout, Stripe payment (card/redirect), success or failure, order confirmation, and email receipt." },
  { value: "chatbot-arch", label: "Chatbot architecture", prompt: "System architecture diagram for a chatbot: User, Frontend chat UI, API Gateway, Auth service, Chat service, LLM provider (OpenAI), vector database for RAG, and Redis for session/cache." },
  { value: "auth0-flow", label: "Auth0 auth flow", prompt: "Flowchart for Auth0 authentication: User clicks Login, redirect to Auth0, login/register, callback to app with tokens, validate token, load user session, then either show dashboard or prompt to complete profile." },
  { value: "gig-marketplace", label: "Gig marketplace architecture", prompt: "Architecture diagram for a gig marketplace (e.g. Fiverr-style): Users (buyers/sellers), Frontend, API Gateway, Search service, Order service, Payment service, Notification service, and databases (users, orders, messages)." },
  { value: "product-microservices", label: "Product page with microservices", prompt: "Microservices architecture for a product detail page: CDN, Frontend, API Gateway, Product service, Inventory service, Reviews service, Recommendations service, and shared Kafka for events." },
  { value: "ecommerce-sql", label: "eCommerce SQL schema", prompt: "Entity-relationship diagram for eCommerce: Users, Orders, Order Items, Products, Categories, Cart, Payments, Shipping Addresses. Show key relationships and cardinality." },
  { value: "twitter-data", label: "Twitter data model", prompt: "Entity-relationship diagram for a Twitter-like app: Users, Tweets, Follows, Likes, Retweets, Replies, Hashtags, Mentions. Show main entities and relationships." },
  { value: "saas-multi-tenant", label: "SaaS multi-tenant architecture", prompt: "Architecture diagram for a multi-tenant SaaS platform: Tenants/Users → Next.js frontend → API Gateway (Kong/AWS) → Microservices (Auth, Billing, Tenant Management, Core App Logic) → PostgreSQL (tenant isolation via RLS), Redis cache, S3 file storage, Stripe billing, SendGrid email. Group by: Frontend, API Layer, Services, Data Layer, External Services." },
  { value: "ci-cd-pipeline", label: "CI/CD pipeline", prompt: "Flowchart for a CI/CD pipeline: Developer pushes code → GitHub webhook → GitHub Actions (lint, test, build, Docker image) → Push to ECR → Deploy to ECS Staging → Run E2E tests → Manual approval gate → Deploy to ECS Production → Health check → Notify Slack. Include rollback path. Use brand icons." },
  { value: "puppy-training", label: "Puppy training user journey", prompt: "User journey / flowchart for a puppy training platform: User signs up, chooses program (self or trainer-led), onboarding with puppy profile, daily lessons, progress tracking, optional adjust plan or add advanced training, completion and certificate." },
  { value: "support-call-flow", label: "Support desk call flow", prompt: "Flowchart for support desk call flow: Call received, IVR menu, route to queue, agent picks up, diagnose issue, resolve or escalate, log ticket, follow-up, close ticket." },
] as const;

export type PresetValue = (typeof DIAGRAM_PRESETS)[number]["value"];

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
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<DiagramTypeValue>("auto");
  const [preset, setPreset] = useState<PresetValue>("none");
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "diagram";
  const focusNodeId = searchParams.get("nodeId");
  const focusNodeLabelFromQuery = searchParams.get("label") || "";
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
  } = useCanvasStore() as any;

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

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Read LLM settings from store
      const { llmProvider, llmModel, llmApiKey, llmBaseUrl } = useCanvasStore.getState();

      const effectiveDiagramType = mode === "mindmap-refine" ? "mindmap" : diagramType;

      // ─── Compute bounding box of existing canvas nodes ─────────
      const existingNodes = Array.isArray(canvasNodes) ? canvasNodes : [];
      const existingEdges = Array.isArray(canvasEdges) ? canvasEdges : [];
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

      let full = "";

      if (llmApiKey) {
        // ─── Direct frontend call (user has API key) ──────────
        const systemPrompt = buildSystemPrompt("horizontal");
        const userMessage = buildUserMessage({
          prompt: prompt.trim(),
          layoutDirection: "horizontal",
          mode,
          focusNodeId,
          diagramType: effectiveDiagramType,
          previousPrompt: lastAIPrompt,
          previousDiagram: lastAIDiagram as Record<string, unknown> | null,
          canvasBounds,
        });

        full = await streamDiagramGeneration({
          provider: llmProvider,
          model: llmModel,
          apiKey: llmApiKey,
          baseUrl: llmBaseUrl || undefined,
          systemPrompt,
          userMessage,
        });
      } else {
        // ─── Fallback: server API route (uses server-side env keys) ──
        const res = await fetch("/api/diagrams/langchain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            previousPrompt: lastAIPrompt,
            previousDiagram: lastAIDiagram,
            layoutDirection: "horizontal",
            mode,
            focusNodeId,
            diagramType: effectiveDiagramType,
            llmProvider,
            llmModel,
            canvasBounds,
          }),
        });

        if (!res.ok || !res.body) {
          let data: Record<string, unknown> = {};
          try {
            data = await res.json();
          } catch {
            // ignore JSON parse error here; we'll fall back to generic message
          }
          throw new Error((data?.error as string) || "Failed to generate diagram");
        }

        // Stream the response text (JSON built up over time for huge diagrams)
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            full += decoder.decode(value, { stream: true });
          }
        }
        full += decoder.decode();
      }

      let parsed: Record<string, unknown>;
      try {
        // Strip markdown fences if the LLM wraps the JSON
        let jsonStr = full.trim();
        if (jsonStr.startsWith("```")) {
          jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
        }
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error("AI returned invalid JSON diagram");
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
      const isNewDiagram = mode !== "mindmap-refine";
      const refId = isNewDiagram
        ? `ref-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        : null;

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

      // Apply grouping from LLM metadata: create group nodes and set parentId on listed nodes
      // (like user selecting nodes and Ctrl+G). Then run layout again so groups are positioned with gaps.
      if (!isMindMapDiagram && groupMetadata.length > 0) {
        const withGroups = applyGroupingFromMetadata(layoutedNodes, groupMetadata);
        layoutedNodes = fitGroupBoundsAndCenterChildren(withGroups);
        // Run layout again (same as first render) so compound graph has proper alignment and gaps between groups
        const afterGroupLayout = await getLayoutedElements(
          layoutedNodes,
          layoutedEdges,
          direction,
          spacing,
          layoutAlgorithm
        );
        layoutedNodes = afterGroupLayout.nodes;
        layoutedEdges = afterGroupLayout.edges;
        layoutedNodes = fitGroupBoundsAndCenterChildren(layoutedNodes);
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
        setNodes(refineLayoutAgain.nodes);
        setEdges(refinedEdgesAfterLayout);
        setPendingFitViewNodeIds(refineLayoutAgain.nodes.map((n: { id: string }) => n.id));
      } else if (mode === "mindmap-refine") {
        if (layoutedNodes.length) addNodes(layoutedNodes);
        if (layoutedEdges.length) addEdges(layoutedEdges);
        setPendingFitViewNodeIds(layoutedNodes.map((n: { id: string }) => n.id));
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
          setNodes(mergedNodes);
          setEdges(mergedEdges);
          setPendingFitViewNodeIds(offsetNodes.map((n: { id: string }) => n.id));
        } else {
          // Canvas is empty — just set the nodes directly
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);
          setPendingFitViewNodeIds(layoutedNodes.map((n: { id: string }) => n.id));
        }
      }

      setLastAIPrompt(prompt.trim());
      setLastAIDiagram({ nodes: layoutedNodes, edges: layoutedEdges });

      // Immediately persist to localStorage before navigation so hydration on
      // the home page picks up the AI-generated nodes instead of the old data.
      saveNow();

      // Fit diagram into view. Do not run panel layout here — we already laid out in this flow; running it again would overwrite with different settings and scatter nodes. On reload the same saved layout shows correctly.
      setPendingFitView(true);
      setTimeout(() => router.push("/"), 450);
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
                onClick={() => router.back()}
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
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-700 block">
                    Load a preset
                  </label>
                  <select
                    value={preset}
                    onChange={(e) => {
                      const v = e.target.value as PresetValue;
                      setPreset(v);
                      const p = DIAGRAM_PRESETS.find((x) => x.value === v);
                      if (p) setPrompt(p.prompt);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    disabled={loading}
                  >
                    {DIAGRAM_PRESETS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
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
              </>
            )}
            <p className="text-xs text-gray-500">
              {mode === "mindmap-refine"
                ? "Describe what new ideas, children or siblings you want to add for this mind map node."
                : "Describe your diagram and we'll create it. Try: \"E‑commerce architecture\" or \"Flowchart for user signup\"."}
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
              error.toLowerCase().includes("api key") ? (
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
                onClick={() => router.back()}
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
