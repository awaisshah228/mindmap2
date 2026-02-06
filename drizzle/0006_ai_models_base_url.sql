-- Add baseUrl for custom models (self-hosted, etc.)
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "base_url" text;
