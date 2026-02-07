import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import {
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenRouterHttpReferer,
  getOpenRouterAppTitle,
  getOpenAiApiKey,
  getAnthropicApiKey,
  getGoogleApiKey,
} from "@/lib/env";
import { getAuthUserId } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { canUseCredits, deductCredits } from "@/lib/credits";
import { getExcalidrawToDiagramSystemPrompt, buildExcalidrawToDiagramUserMessage } from "@/lib/ai/excalidraw-to-diagram-prompt";
import type { Node, Edge } from "@xyflow/react";

export const runtime = "nodejs";

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
};

function resolveModelName(provider: string | undefined, model: string | undefined): string {
  const fallback = "gpt-4o-mini";
  if (!model) return fallback;
  if (provider === "openrouter") return model.includes("/") ? model : `openai/${model}`;
  return model.includes("/") ? model.split("/").pop()! : model;
}

function extractJsonArrayOrObject(text: string): { nodes?: unknown[]; edges?: unknown[] } {
  const trimmed = text.trim();
  let jsonStr = trimmed;
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();
  const objMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]) as { nodes?: unknown[]; edges?: unknown[] };
    } catch {
      // fallthrough
    }
  }
  return {};
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const admin = userId ? await isAdmin() : false;

    const body = await req.json();
    const { elements: rawElements = [], llmProvider, llmModel, llmApiKey, cloudModelId } = body as {
      elements?: unknown[];
      llmProvider?: string;
      llmModel?: string;
      llmApiKey?: string;
      cloudModelId?: string;
    };

    const elements = Array.isArray(rawElements) ? rawElements : [];
    const activeEls = elements.filter((e: unknown) => !(e as { isDeleted?: boolean })?.isDeleted);
    if (activeEls.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    if (userId && !admin && !llmApiKey) {
      const can = await canUseCredits(userId);
      if (!can.ok) {
        return NextResponse.json({ error: can.reason ?? "Insufficient credits" }, { status: 402 });
      }
    }

    let provider: string;
    let effectiveModel: string;
    let resolvedBaseUrl: string | undefined;
    if (llmApiKey) {
      provider = llmProvider ?? "openrouter";
      effectiveModel = resolveModelName(provider, llmModel);
    } else {
      const { resolveCloudModel } = await import("@/lib/ai-models");
      const resolved = await resolveCloudModel(cloudModelId);
      if (!resolved) {
        provider = "openrouter";
        effectiveModel = resolveModelName(provider, undefined);
      } else {
        provider = resolved.provider;
        effectiveModel = resolveModelName(provider, resolved.model);
        resolvedBaseUrl = resolved.baseUrl;
      }
    }
    let apiKey: string;
    let baseURL: string | undefined;
    let defaultHeaders: Record<string, string> = {};
    const openRouterKey = getOpenRouterApiKey();
    const openAiKey = getOpenAiApiKey();

    if (resolvedBaseUrl) {
      baseURL = resolvedBaseUrl;
      if (provider === "openrouter") {
        apiKey = llmApiKey || openRouterKey;
        defaultHeaders = { "HTTP-Referer": getOpenRouterHttpReferer(), "X-Title": getOpenRouterAppTitle() };
      } else if (provider === "openai") apiKey = llmApiKey || openAiKey;
      else if (provider === "anthropic") apiKey = llmApiKey || getAnthropicApiKey() || openRouterKey || openAiKey;
      else if (provider === "google") apiKey = llmApiKey || getGoogleApiKey() || openRouterKey || openAiKey;
      else apiKey = llmApiKey || openAiKey || openRouterKey;
    } else if (provider === "openrouter") {
      apiKey = llmApiKey || openRouterKey;
      baseURL = getOpenRouterBaseUrl();
      defaultHeaders = { "HTTP-Referer": getOpenRouterHttpReferer(), "X-Title": getOpenRouterAppTitle() };
    } else if (provider === "openai") {
      apiKey = llmApiKey || openAiKey;
      baseURL = PROVIDER_BASE_URLS.openai;
    } else if (provider === "anthropic") {
      apiKey = llmApiKey || getAnthropicApiKey() || openRouterKey || openAiKey;
      baseURL = PROVIDER_BASE_URLS.anthropic;
    } else if (provider === "google") {
      apiKey = llmApiKey || getGoogleApiKey() || openRouterKey || openAiKey;
      baseURL = PROVIDER_BASE_URLS.google;
    } else {
      apiKey = llmApiKey || openAiKey;
      baseURL = PROVIDER_BASE_URLS.openai;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "No API key. Use Instant convert or add a key in Settings." },
        { status: 400 }
      );
    }

    const systemPrompt = getExcalidrawToDiagramSystemPrompt();
    const userMessage = buildExcalidrawToDiagramUserMessage(activeEls as Parameters<typeof buildExcalidrawToDiagramUserMessage>[0]);

    const llm = new ChatOpenAI({
      model: effectiveModel,
      temperature: 0.2,
      apiKey,
      configuration: {
        baseURL: baseURL ?? undefined,
        defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
      },
    });

    const response = await llm.invoke([
      ["system", systemPrompt],
      ["user", userMessage],
    ]);
    const text = typeof response.content === "string" ? response.content : String(response.content ?? "");

    const parsed = extractJsonArrayOrObject(text);
    const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
    const rawEdges = Array.isArray(parsed.edges) ? parsed.edges : [];

    const nodes: Node[] = rawNodes.map((n, i) => {
      const node = n as Record<string, unknown>;
      const id = String(node.id ?? `node-${i}`);
      const pos = node.position as { x?: number; y?: number } | undefined;
      const x = Number(pos?.x ?? node.x ?? 0);
      const y = Number(pos?.y ?? node.y ?? 0);
      return {
        id,
        type: (node.type as string) || "rectangle",
        position: { x, y },
        data: { label: node.label ?? (node.data as Record<string, unknown>)?.label ?? "" },
        width: node.width != null ? Number(node.width) : undefined,
        height: node.height != null ? Number(node.height) : undefined,
      } as Node;
    });

    const edges: Edge[] = rawEdges.map((e, i) => {
      const edge = e as Record<string, unknown>;
      return {
        id: String(edge.id ?? `e-${edge.source}-${edge.target}-${i}`),
        source: String(edge.source ?? ""),
        target: String(edge.target ?? ""),
        data: edge.data ?? (edge.label ? { label: edge.label } : {}),
      } as Edge;
    });

    if (userId && !admin && !llmApiKey) {
      await deductCredits(userId);
    }

    return NextResponse.json({ nodes, edges });
  } catch (err) {
    console.error("Convert Excalidraw to diagram error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Conversion failed" },
      { status: 500 }
    );
  }
}
