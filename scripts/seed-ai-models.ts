/**
 * Seed default AI models for paid users (no own API key).
 * Run: npx tsx scripts/seed-ai-models.ts
 */

import "dotenv/config";
import { db } from "../src/db";
import { aiModels } from "../src/db/schema";

const DEFAULT_MODELS = [
  { provider: "openrouter", model: "openai/gpt-4o-mini", label: "GPT-4o Mini", isDefault: true, sortOrder: 0 },
  { provider: "openrouter", model: "openai/gpt-4o", label: "GPT-4o", isDefault: false, sortOrder: 1 },
  { provider: "openrouter", model: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", isDefault: false, sortOrder: 2 },
];

async function seed() {
  const existing = await db.select().from(aiModels);
  if (existing.length > 0) {
    console.log(`Already ${existing.length} AI model(s) in DB. Skipping seed.`);
    process.exit(0);
    return;
  }

  await db.insert(aiModels).values(DEFAULT_MODELS);
  console.log(`Seeded ${DEFAULT_MODELS.length} AI models.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
