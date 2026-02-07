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
import {
  getMermaidSystemPrompt,
  buildMermaidUserMessage,
  buildMermaidRefineUserMessage,
} from "@/lib/ai/mermaid-generate-prompt";
import { detectExcalidrawLibraryFromPrompt, loadExcalidrawLibrary } from "@/lib/excalidraw-library";

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

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    const admin = userId ? await isAdmin() : false;

    const body = await req.json();
    const { prompt, llmProvider, llmModel, llmApiKey, cloudModelId, refine, existingContext } = body as {
      prompt?: string;
      llmProvider?: string;
      llmModel?: string;
      llmApiKey?: string;
      cloudModelId?: string;
      refine?: boolean;
      existingContext?: string;
    };

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
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
        { error: "No API key. Add your key in Settings → Integration to generate Mermaid diagrams." },
        { status: 400 }
      );
    }

    // Load library context for diagram types (flowchart, system-design) — helps Mermaid align with Excalidraw libraries
    const trimmedPrompt = prompt.trim();
    const flowchartContext = await loadExcalidrawLibrary("flowchart");
    const systemDesignContext = await loadExcalidrawLibrary("system-design");
    const detectedLib = detectExcalidrawLibraryFromPrompt(trimmedPrompt);
    const extraContext =
      detectedLib && detectedLib !== "flowchart" && detectedLib !== "system-design"
        ? await loadExcalidrawLibrary(detectedLib)
        : null;
    const libraryContext = [flowchartContext, systemDesignContext, extraContext].filter(Boolean).join("\n\n---\n\n") || null;
    const systemPrompt = getMermaidSystemPrompt(libraryContext ?? undefined);

    const userMessage = refine && existingContext
      ? buildMermaidRefineUserMessage(trimmedPrompt, existingContext)
      : buildMermaidUserMessage(trimmedPrompt);

    const llm = new ChatOpenAI({
      model: effectiveModel,
      temperature: 0.2,
      apiKey,
      streaming: true,
      configuration: {
        baseURL: baseURL ?? undefined,
        defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
      },
    });

    const stream = await llm.stream([
      ["system", systemPrompt],
      ["user", userMessage],
    ]);

    const encoder = new TextEncoder();
    let fullText = "";

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text =
              typeof chunk.content === "string"
                ? chunk.content
                : Array.isArray(chunk.content)
                  ? (chunk.content as { text?: string }[]).map((c) => (typeof c === "string" ? c : c?.text ?? "")).join("")
                  : String(chunk.content ?? "");
            if (text) {
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
          if (userId && !admin && !llmApiKey) {
            await deductCredits(userId);
          }
        } catch (err) {
          console.error("Generate Mermaid stream error:", err);
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
    console.error("Generate Mermaid error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
