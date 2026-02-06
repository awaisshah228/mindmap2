import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import {
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenRouterHttpReferer,
  getOpenRouterAppTitle,
  getOpenAiApiKey,
} from "@/lib/env";
import { getAuthUserId } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { canUseCredits, deductCredits } from "@/lib/credits";
import { getDiagramToExcalidrawSystemPrompt, buildDiagramToExcalidrawUserMessage } from "@/lib/ai/diagram-to-excalidraw-prompt";
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

function normalizeNodesForPrompt(nodes: unknown[]): { id: string; type?: string; label?: string; x: number; y: number; width: number; height: number; backgroundColor?: string }[] {
  const out: { id: string; type?: string; label?: string; x: number; y: number; width: number; height: number; backgroundColor?: string }[] = [];
  const defaultW = 160;
  const defaultH = 48;
  for (const n of nodes) {
    const node = n as { id?: string; type?: string; data?: { label?: string; backgroundColor?: string }; position?: { x?: number; y?: number }; width?: number; height?: number; measured?: { width?: number; height?: number } };
    const id = node.id ?? `node-${out.length}`;
    const x = Number(node.position?.x) ?? 0;
    const y = Number(node.position?.y) ?? 0;
    const w = Number(node.measured?.width ?? node.width ?? defaultW) || defaultW;
    const h = Number(node.measured?.height ?? node.height ?? defaultH) || defaultH;
    out.push({
      id,
      type: node.type as string | undefined,
      label: (node.data?.label as string) ?? "",
      x,
      y,
      width: w,
      height: h,
      backgroundColor: node.data?.backgroundColor as string | undefined,
    });
  }
  return out;
}

function normalizeEdgesForPrompt(edges: unknown[]): { id: string; source: string; target: string; label?: string }[] {
  const out: { id: string; source: string; target: string; label?: string }[] = [];
  for (const e of edges) {
    const edge = e as { id?: string; source?: string; target?: string; data?: { label?: string } };
    out.push({
      id: edge.id ?? `e-${edge.source}-${edge.target}-${out.length}`,
      source: String(edge.source ?? ""),
      target: String(edge.target ?? ""),
      label: edge.data?.label as string | undefined,
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const admin = userId ? await isAdmin() : false;

    const body = await req.json();
    const { nodes: rawNodes = [], edges: rawEdges = [], llmProvider, llmModel, llmApiKey } = body as {
      nodes?: unknown[];
      edges?: unknown[];
      llmProvider?: string;
      llmModel?: string;
      llmApiKey?: string;
    };

    const nodes = Array.isArray(rawNodes) ? (rawNodes as Node[]) : [];
    const edges = Array.isArray(rawEdges) ? (rawEdges as Edge[]) : [];

    if (nodes.length === 0 && edges.length === 0) {
      return NextResponse.json({ elements: [] });
    }

    if (userId && !admin && !llmApiKey) {
      const can = await canUseCredits(userId);
      if (!can.ok) {
        return NextResponse.json({ error: can.reason ?? "Insufficient credits" }, { status: 402 });
      }
    }

    const provider = llmProvider ?? "openrouter";
    let apiKey: string;
    let baseURL: string | undefined;
    let defaultHeaders: Record<string, string> = {};
    const openRouterKey = getOpenRouterApiKey();
    const openAiKey = getOpenAiApiKey();

    if (provider === "openrouter") {
      apiKey = llmApiKey || openRouterKey;
      baseURL = getOpenRouterBaseUrl();
      defaultHeaders = { "HTTP-Referer": getOpenRouterHttpReferer(), "X-Title": getOpenRouterAppTitle() };
    } else if (provider === "openai") {
      apiKey = llmApiKey || openAiKey;
      baseURL = PROVIDER_BASE_URLS.openai;
    } else if (provider === "anthropic" || provider === "google") {
      apiKey = llmApiKey || openRouterKey || openAiKey;
      baseURL = provider === "anthropic" ? PROVIDER_BASE_URLS.anthropic : PROVIDER_BASE_URLS.google;
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

    const effectiveModel = resolveModelName(provider, llmModel);

    const normalizedNodes = normalizeNodesForPrompt(nodes);
    const normalizedEdges = normalizeEdgesForPrompt(edges);
    const systemPrompt = getDiagramToExcalidrawSystemPrompt();
    const userMessage = buildDiagramToExcalidrawUserMessage(normalizedNodes, normalizedEdges);

    const llm = new ChatOpenAI({
      model: effectiveModel,
      temperature: 0.2,
      apiKey,
      streaming: true,
      configuration: {
        baseURL: provider === "openrouter" ? baseURL : undefined,
        defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
      },
    });

    const stream = await llm.stream([
      ["system", systemPrompt],
      ["user", userMessage],
    ]);

    const encoder = new TextEncoder();

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text =
              typeof chunk.content === "string"
                ? chunk.content
                : Array.isArray(chunk.content)
                  ? (chunk.content as { text?: string }[])
                      .map((c) => (typeof c === "string" ? c : c?.text ?? ""))
                      .join("")
                  : String(chunk.content ?? "");
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
          if (userId && !admin && !llmApiKey) {
            await deductCredits(userId);
          }
        } catch (err) {
          console.error("Convert to Excalidraw stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    console.error("Convert to Excalidraw error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Conversion failed" },
      { status: 500 }
    );
  }
}
