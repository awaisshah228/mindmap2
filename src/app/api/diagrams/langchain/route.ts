import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { buildSystemPrompt, buildUserMessage } from "@/lib/ai/prompt-builder";
import {
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenRouterHttpReferer,
  getOpenRouterAppTitle,
  getOpenAiApiKey,
} from "@/lib/env";

export const runtime = "nodejs";

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
    } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Determine effective provider, model, and API key
    const provider: string = llmProvider || "openrouter";
    const effectiveModel = resolveModelName(provider, llmModel || model);

    let apiKey: string;
    let baseURL: string | undefined;
    let defaultHeaders: Record<string, string> = {};

    if (provider === "openrouter") {
      apiKey = llmApiKey || getOpenRouterApiKey();
      baseURL = getOpenRouterBaseUrl();
      defaultHeaders = {
        "HTTP-Referer": getOpenRouterHttpReferer(),
        "X-Title": getOpenRouterAppTitle(),
      };
    } else if (provider === "openai") {
      apiKey = llmApiKey || getOpenAiApiKey();
      baseURL = PROVIDER_BASE_URLS.openai;
    } else if (provider === "anthropic") {
      apiKey = llmApiKey || "";
      baseURL = PROVIDER_BASE_URLS.anthropic;
    } else if (provider === "google") {
      apiKey = llmApiKey || "";
      baseURL = PROVIDER_BASE_URLS.google;
    } else {
      // custom — user must supply key; baseURL is OpenAI-compatible by default
      apiKey = llmApiKey || getOpenAiApiKey();
      baseURL = PROVIDER_BASE_URLS.openai;
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: `API key not configured for provider "${provider}". Add your key in Settings → Integration.` },
        { status: 500 }
      );
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
            // Each chunk is an AIMessageChunk; get its content as string.
            const text =
              typeof chunk.content === "string"
                ? chunk.content
                : Array.isArray(chunk.content)
                  ? chunk.content
                      .map((c: any) => (typeof c === "string" ? c : c.text ?? ""))
                      .join("")
                  : String(chunk.content ?? "");

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
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

