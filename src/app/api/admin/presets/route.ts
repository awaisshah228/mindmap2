import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/db";
import { diagramPresets, PRESET_LEVELS } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  const templates = req.nextUrl.searchParams.get("templates");
  const level = req.nextUrl.searchParams.get("level");

  const rows = await db
    .select()
    .from(diagramPresets)
    .orderBy(asc(diagramPresets.sortOrder), asc(diagramPresets.name));

  let list = rows.map((r) => ({
    id: r.id,
    name: r.name,
    label: r.label,
    description: r.description,
    diagramType: r.diagramType,
    level: r.level,
    prompt: r.prompt,
    isTemplate: r.isTemplate,
    sortOrder: r.sortOrder,
    previewImageUrl: r.previewImageUrl,
    hasNodes: Array.isArray(r.nodes) && r.nodes.length > 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  if (templates === "true") list = list.filter((r) => r.isTemplate);
  else if (templates === "false") list = list.filter((r) => !r.isTemplate);
  if (level) list = list.filter((r) => r.level === level);

  return NextResponse.json({ presets: list });
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : name;
  const description = typeof body.description === "string" ? body.description : "";
  const diagramType = typeof body.diagramType === "string" ? body.diagramType : "flow";
  const level = typeof body.level === "string" && (PRESET_LEVELS as readonly string[]).includes(body.level) ? body.level : "high-level-flow";
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const isTemplate = body.isTemplate === true;
  const sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : 0;
  const previewImageUrl = typeof body.previewImageUrl === "string" ? body.previewImageUrl : "";

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const [inserted] = await db
    .insert(diagramPresets)
    .values({
      name,
      label,
      description,
      diagramType,
      level,
      nodes,
      edges,
      prompt,
      isTemplate,
      sortOrder,
      previewImageUrl: previewImageUrl || null,
    })
    .returning({ id: diagramPresets.id });

  return NextResponse.json({ id: inserted?.id });
}
