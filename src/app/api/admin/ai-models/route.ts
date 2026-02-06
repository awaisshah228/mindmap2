import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/db";
import { aiModels } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

const PROVIDERS = ["openai", "openrouter", "anthropic", "google", "custom"] as const;

export async function GET() {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  const rows = await db
    .select()
    .from(aiModels)
    .orderBy(asc(aiModels.sortOrder), asc(aiModels.label));

  return NextResponse.json({
    models: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      label: r.label,
      baseUrl: r.baseUrl ?? null,
      isDefault: r.isDefault,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider = typeof body.provider === "string" && PROVIDERS.includes(body.provider as (typeof PROVIDERS)[number])
    ? body.provider
    : "openrouter";
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : model || "Untitled";
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() || null : null;
  const isDefault = body.isDefault === true;
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0;

  if (!model) {
    return NextResponse.json({ error: "model is required" }, { status: 400 });
  }

  if (isDefault) {
    await db.update(aiModels).set({ isDefault: false, updatedAt: new Date() });
  }

  const [inserted] = await db
    .insert(aiModels)
    .values({ provider, model, label, baseUrl, isDefault, sortOrder })
    .returning({ id: aiModels.id });

  return NextResponse.json({ id: inserted?.id });
}
