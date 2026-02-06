/**
 * Central env with fallbacks when .env is missing or vars are unset.
 * Non-secret defaults only; API keys and DATABASE_URL use empty string so the app
 * doesn't crash—routes still return an error when keys are required.
 */

const FALLBACK = {
  OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
  OPENROUTER_HTTP_REFERER: "http://localhost:3000",
  OPENROUTER_APP_TITLE: "AI Diagram Generator",
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

/** Anthropic API key for direct Claude API calls. */
export function getAnthropicApiKey(): string {
  return process.env.ANTHROPIC_API_KEY ?? "";
}

/** Google API key for Gemini / Generative AI. */
export function getGoogleApiKey(): string {
  return process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
}

/** Database URL — only call from server. Set in .env to your Neon URL (e.g. from https://neon.tech). No fallback so missing/invalid URL is caught and routes can return fallbacks. */
export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? "";
}

/** Stripe secret key. */
export function getStripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY ?? "";
}

/** Stripe webhook secret for verifying webhooks. */
export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? "";
}

/** S3 bucket for user uploads (icons, attachments). */
export function getS3Bucket(): string {
  return process.env.S3_BUCKET ?? "";
}

export function getAwsRegion(): string {
  return process.env.AWS_REGION ?? "us-east-1";
}
