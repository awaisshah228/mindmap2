/**
 * Central env with fallbacks when .env is missing or vars are unset.
 * Non-secret defaults only; API keys and DATABASE_URL use empty string so the app
 * doesn't crash—routes still return an error when keys are required.
 */

const FALLBACK = {
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  OPENROUTER_HTTP_REFERER: "http://localhost:3000",
  OPENROUTER_APP_TITLE: "AI Diagram Generator",
  DATABASE_URL: "postgresql://user:pass@host/db?sslmode=require",
} as const;

/** OpenRouter API key; fallback empty so route can return 500 if not set. */
export function getOpenRouterApiKey(): string {
  return process.env.OPENROUTER_API_KEY ?? "";
}

export function getOpenRouterBaseUrl(): string {
  return process.env.OPENROUTER_BASE_URL ?? FALLBACK.OPENROUTER_BASE_URL;
}

export function getOpenRouterHttpReferer(): string {
  return process.env.OPENROUTER_HTTP_REFERER ?? FALLBACK.OPENROUTER_HTTP_REFERER;
}

export function getOpenRouterAppTitle(): string {
  return process.env.OPENROUTER_APP_TITLE ?? FALLBACK.OPENROUTER_APP_TITLE;
}

/** OpenAI API key; fallback empty so route can return 500 if not set. */
export function getOpenAiApiKey(): string {
  return process.env.OPENAI_API_KEY ?? "";
}

/** Database URL; fallback to placeholder so db client doesn't see undefined. */
export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? FALLBACK.DATABASE_URL;
}
