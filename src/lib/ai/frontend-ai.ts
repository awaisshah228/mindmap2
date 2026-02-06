/**
 * Direct frontend AI calls — bypasses the server API route.
 * Used when the user has provided their own API key.
 * Supports streaming from OpenAI-compatible endpoints.
 */

import type { LLMProvider } from "@/lib/store/canvas-store";

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  google:
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

export interface FrontendAIParams {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl?: string; // for "custom" provider
  systemPrompt: string;
  userMessage: string;
  onChunk?: (text: string) => void;
}

/**
 * Streams a chat completion from the chosen LLM provider and returns the full response text.
 * Works for OpenAI-compatible APIs (OpenAI, OpenRouter, Google Gemini OpenAI-compat, custom).
 * Anthropic uses its own message format.
 */
export async function streamDiagramGeneration(
  params: FrontendAIParams
): Promise<string> {
  const { provider, model, apiKey, baseUrl, systemPrompt, userMessage, onChunk } =
    params;

  if (provider === "anthropic") {
    return streamAnthropic(params);
  }

  // OpenAI-compatible endpoint
  const endpoint =
    provider === "custom" && baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/chat/completions`
      : PROVIDER_ENDPOINTS[provider] ?? PROVIDER_ENDPOINTS.openai;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // OpenRouter extras
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "AI Diagram Generator";
  }

  const effectiveModel =
    provider === "openrouter" && !model.includes("/")
      ? `openai/${model}`
      : model;

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: effectiveModel,
      temperature: 0.2,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`AI request failed (${res.status}): ${errText}`);
  }

  return parseSSEStream(res, onChunk);
}

/** Parse SSE stream from OpenAI-compatible endpoints */
async function parseSSEStream(
  res: Response,
  onChunk?: (text: string) => void
): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process SSE lines
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onChunk?.(delta);
        }
      } catch {
        // skip malformed JSON chunks
      }
    }
  }

  return full;
}

/** Anthropic uses a different API format */
async function streamAnthropic(params: FrontendAIParams): Promise<string> {
  const { model, apiKey, systemPrompt, userMessage, onChunk } = params;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`Anthropic request failed (${res.status}): ${errText}`);
  }

  // Anthropic SSE format: event types include content_block_delta
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(trimmed.slice(6));
        if (json.type === "content_block_delta" && json.delta?.text) {
          full += json.delta.text;
          onChunk?.(json.delta.text);
        }
      } catch {
        // skip
      }
    }
  }

  return full;
}
