/**
 * GET /api/ai-models — list admin-configured cloud models for paid users (no own API key).
 * Public (no auth required) — used by frontend to show model picker when user has no API key.
 */

import { NextResponse } from "next/server";
import { listCloudAIModels } from "@/lib/ai-models";

export async function GET() {
  try {
    const models = await listCloudAIModels();
    return NextResponse.json({ models });
  } catch (err) {
    console.error("List AI models error:", err);
    return NextResponse.json({ error: "Failed to list models", models: [] }, { status: 500 });
  }
}
