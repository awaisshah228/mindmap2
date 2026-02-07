/**
 * Admin-configured AI models for paid users (no own API key).
 * When user has no API key, backend ignores frontend model selection and uses
 * either cloudModelId from request (if valid) or the default model.
 * When no admin models exist, falls back to env keys (OPENAI_API_KEY, etc.).
 */

import { db } from "@/db";
import { aiModels } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import {
  getOpenRouterApiKey,
  getOpenRouterBaseUrl,
  getOpenAiApiKey,
  getAnthropicApiKey,
  getGoogleApiKey,
} from "@/lib/env";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

function getProviderBaseUrls(): Record<string, string> {
  return {
    openai: "https://api.openai.com/v1",
    openrouter: getOpenRouterBaseUrl() || OPENROUTER_BASE,
    anthropic: "https://api.anthropic.com/v1",
    google: "https://generativelanguage.googleapis.com/v1beta/openai",
    custom: "https://api.openai.com/v1", // fallback for custom when no baseUrl set
  };
}

export type CloudAIModel = {
  id: string;
  provider: string;
  model: string;
  label: string;
  baseUrl?: string | null;
  isDefault: boolean;
  sortOrder: number;
};

export type ResolvedCloudModel = {
  provider: string;
  model: string;
  baseUrl?: string;
  label?: string; // for display
};

/** List all admin-configured cloud models (for users without API key). */
export async function listCloudAIModels(): Promise<CloudAIModel[]> {
  const rows = await db
    .select()
    .from(aiModels)
    .orderBy(asc(aiModels.sortOrder), asc(aiModels.label));
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    model: r.model,
    label: r.label,
    baseUrl: r.baseUrl ?? null,
    isDefault: r.isDefault,
    sortOrder: r.sortOrder,
  }));
}

/** Get the default cloud model, or first one if none marked default. */
export async function getDefaultCloudModel(): Promise<CloudAIModel | null> {
  const rows = await db
    .select()
    .from(aiModels)
    .orderBy(asc(aiModels.sortOrder), asc(aiModels.label));
  const defaultRow = rows.find((r) => r.isDefault) ?? rows[0];
  if (!defaultRow) return null;
  return {
    id: defaultRow.id,
    provider: defaultRow.provider,
    model: defaultRow.model,
    label: defaultRow.label,
    baseUrl: defaultRow.baseUrl ?? null,
    isDefault: defaultRow.isDefault,
    sortOrder: defaultRow.sortOrder,
  };
}

/** Get default model from env when no admin models configured. Uses first available env key. */
export function getDefaultEnvModel(): ResolvedCloudModel | null {
  const openRouterKey = getOpenRouterApiKey();
  const openAiKey = getOpenAiApiKey();
  const anthropicKey = getAnthropicApiKey();
  const googleKey = getGoogleApiKey();

  const urls = getProviderBaseUrls();
  if (openAiKey) {
    return { provider: "openai", model: "gpt-4o-mini", baseUrl: urls.openai, label: "GPT-4o Mini (env)" };
  }
  if (openRouterKey) {
    return { provider: "openrouter", model: "openai/gpt-4o-mini", baseUrl: urls.openrouter, label: "OpenRouter gpt-4o-mini (env)" };
  }
  if (anthropicKey) {
    return { provider: "anthropic", model: "claude-sonnet-4-5-20250929", baseUrl: urls.anthropic, label: "Claude Sonnet 4.5 (env)" };
  }
  if (googleKey) {
    return { provider: "google", model: "gemini-2.0-flash", baseUrl: urls.google, label: "Gemini 2.0 Flash (env)" };
  }
  return null;
}

/** Which providers have API keys configured in env (admin-only, no actual keys). */
export function getEnvProviderStatus(): { provider: string; configured: boolean; label: string }[] {
  return [
    { provider: "openai", configured: !!getOpenAiApiKey(), label: "OpenAI (OPENAI_API_KEY)" },
    { provider: "openrouter", configured: !!getOpenRouterApiKey(), label: "OpenRouter (OPENROUTER_API_KEY)" },
    { provider: "anthropic", configured: !!getAnthropicApiKey(), label: "Anthropic (ANTHROPIC_API_KEY)" },
    { provider: "google", configured: !!getGoogleApiKey(), label: "Google (GOOGLE_API_KEY)" },
  ];
}

/** Resolve provider + model + baseUrl from cloudModelId. When no admin models, falls back to env. */
export async function resolveCloudModel(
  cloudModelId: string | undefined
): Promise<ResolvedCloudModel | null> {
  const urls = getProviderBaseUrls();
  if (cloudModelId) {
    const [row] = await db.select().from(aiModels).where(eq(aiModels.id, cloudModelId));
    if (row) {
      const baseUrl = row.baseUrl?.trim() || urls[row.provider] || undefined;
      return { provider: row.provider, model: row.model, baseUrl, label: row.label };
    }
  }
  const def = await getDefaultCloudModel();
  if (def) {
    const baseUrl = def.baseUrl?.trim() || urls[def.provider] || undefined;
    return { provider: def.provider, model: def.model, baseUrl, label: def.label };
  }
  // No admin models: fall back to env
  return getDefaultEnvModel();
}
