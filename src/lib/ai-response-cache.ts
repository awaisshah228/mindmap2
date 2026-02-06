/**
 * In-memory LRU cache for AI diagram generation responses.
 * When the same prompt + model + provider is used again, returns cached result
 * instead of calling the API — saves cost and improves response time.
 */

import { createHash } from "crypto";

const MAX_ENTRIES = 500;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  value: string;
  expiresAt: number;
}

/** LRU cache: Map preserves insertion order, we delete oldest when over limit */
const cache = new Map<string, CacheEntry>();

function hashKey(parts: string[]): string {
  const str = parts.join("\0");
  return createHash("sha256").update(str).digest("hex").slice(0, 32);
}

/**
 * Generate cache key for a request.
 * Include prompt, model, provider, and route type so different contexts don't collide.
 */
export function getCacheKey(
  route: "drawio" | "excalidraw" | "langchain" | "convert",
  prompt: string,
  model: string,
  provider: string,
  extra?: string
): string {
  const normalized = prompt.trim().toLowerCase();
  const parts = [route, normalized, model, provider];
  if (extra) parts.push(extra);
  return hashKey(parts);
}

/**
 * Get cached response if it exists and hasn't expired.
 */
export function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // Move to end (most recently used) by re-inserting
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

/**
 * Store response in cache. Evict oldest entries if over limit.
 */
export function setCached(key: string, value: string): void {
  while (cache.size >= MAX_ENTRIES && cache.size > 0) {
    const first = cache.keys().next();
    if (first.done) break;
    cache.delete(first.value);
  }
  cache.set(key, {
    value,
    expiresAt: Date.now() + TTL_MS,
  });
}

/**
 * Create a Response with cached text as streaming body (for cache hit).
 */
export function cachedStreamResponse(text: string): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-AI-Cache": "hit",
    },
  });
}
