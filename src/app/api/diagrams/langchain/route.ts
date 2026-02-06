import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { buildSystemPrompt, buildUserMessage } from "@/lib/ai/prompt-builder";
import {
  getCacheKey,
  getCached,
  setCached,
  cachedStreamResponse,
} from "@/lib/ai-response-cache";
import {
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenRouterHttpReferer,
  getOpenRouterAppTitle,
  getOpenAiApiKey,
  getAnthropicApiKey,
  getGoogleApiKey,
} from "@/lib/env";

export const runtime = "nodejs";

/**
 * No auth required — allows testing and use without login.
 * When the client sends no API key, the server uses OPENROUTER_API_KEY (or OPENAI_API_KEY) so AI works for unsigned users.
 */

/** Provider → base URL mapping for non-OpenRouter providers */
const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
};

/**
 * Build the model name suitable for the selected provider.
 * OpenRouter expects prefixed names like "openai/gpt-4o-mini".
 * Direct providers use just "gpt-4o-mini".
 */
function resolveModelName(provider: string | undefined, model: string | undefined): string {
  const fallback = "gpt-4o-mini";
  if (!model) return fallback;

  if (provider === "openrouter") {
    // If the model already has a prefix (e.g. "openai/gpt-4o"), use it.
    // Otherwise, prepend "openai/" as default.
    return model.includes("/") ? model : `openai/${model}`;
  }

  // For direct providers, strip any "openai/" or "anthropic/" prefix
  return model.includes("/") ? model.split("/").pop()! : model;
}

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      model,
      previousPrompt,
      previousDiagram,
      layoutDirection,
      mode,
      focusNodeId,
      diagramType,
      llmProvider,
      llmModel,
      llmApiKey,
      cloudModelId,
      canvasBounds,
      mindMapStructure,
    } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // When no user API key: ignore frontend model selection; use admin-configured cloud model or env default.
    let provider: string;
    let effectiveModel: string;
    let resolvedBaseUrl: string | undefined;
    if (llmApiKey) {
      provider = llmProvider || "openrouter";
      effectiveModel = resolveModelName(provider, llmModel || model);
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
    let usingOpenRouterFallback = false;

    // Determine API key and base URL. Use resolvedBaseUrl when from admin/env cloud model.
    // If the provider-specific key is missing, fall back to the OpenRouter key
    // (which can route to any model via OpenRouter's unified API).
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
      defaultHeaders = {
        "HTTP-Referer": getOpenRouterHttpReferer(),
        "X-Title": getOpenRouterAppTitle(),
      };
    } else if (provider === "openai") {
      apiKey = llmApiKey || openAiKey;
      baseURL = PROVIDER_BASE_URLS.openai;
    } else if (provider === "anthropic") {
      apiKey = llmApiKey || getAnthropicApiKey();
      baseURL = PROVIDER_BASE_URLS.anthropic;
    } else if (provider === "google") {
      apiKey = llmApiKey || getGoogleApiKey();
      baseURL = PROVIDER_BASE_URLS.google;
    } else {
      // custom — user must supply key; baseURL is OpenAI-compatible by default
      apiKey = llmApiKey || openAiKey;
      baseURL = PROVIDER_BASE_URLS.openai;
    }

    // Fallback: if provider-specific key is not available, route through OpenRouter instead
    if (!apiKey && openRouterKey) {
      apiKey = openRouterKey;
      baseURL = getOpenRouterBaseUrl();
      defaultHeaders = {
        "HTTP-Referer": getOpenRouterHttpReferer(),
        "X-Title": getOpenRouterAppTitle(),
      };
      usingOpenRouterFallback = true;
      // Re-resolve model name for OpenRouter format (needs prefix like "openai/gpt-4o-mini")
      effectiveModel = resolveModelName("openrouter", llmModel || model);
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `No API key available. Add your key in Settings → Integration to use AI features.` },
        { status: 400 }
      );
    }

    console.log(`[AI Route] provider=${usingOpenRouterFallback ? "openrouter(fallback)" : provider}, model=${effectiveModel}`);

    const cacheExtra = [layoutDirection, mode, diagramType].filter(Boolean).join(":");
    const cacheKey = getCacheKey("langchain", prompt.trim(), effectiveModel, provider, cacheExtra);
    const cached = getCached(cacheKey);
    if (cached) {
      return cachedStreamResponse(cached);
    }

    const llm = new ChatOpenAI({
      model: effectiveModel,
      temperature: 0.2,
      apiKey,
      streaming: true,
      configuration: {
        baseURL,
        defaultHeaders: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
      },
    });

    const systemPrompt = buildSystemPrompt(layoutDirection);
    const userMessage = buildUserMessage({
      prompt,
      layoutDirection,
      mode,
      focusNodeId,
      diagramType,
      previousPrompt,
      previousDiagram,
      canvasBounds: canvasBounds ?? null,
      mindMapStructure: mindMapStructure ?? null,
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
                  ? chunk.content
                      .map((c: any) => (typeof c === "string" ? c : c.text ?? ""))
                      .join("")
                  : String(chunk.content ?? "");

            if (text) {
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          }
          if (fullText) setCached(cacheKey, fullText);
        } catch (err) {
          console.error("LangChain stream error:", err);
          controller.error(err);
          return;
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    console.error("LangChain diagram generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}

