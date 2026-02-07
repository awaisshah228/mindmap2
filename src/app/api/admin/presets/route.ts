import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/db";
import { diagramPresets, PRESET_LEVELS } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const userId = await requireAdmin();
  if (userId instanceof NextResponse) return userId;

  try {
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
      targetCanvas: r.targetCanvas ?? "reactflow",
      dataFormat: r.dataFormat ?? undefined,
      hasNodes: Array.isArray(r.nodes) && r.nodes.length > 0,
      hasExcalidraw: !!r.excalidrawData && typeof r.excalidrawData === "object",
      hasMermaid: !!r.mermaidData,
      hasDrawio: !!r.drawioData,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    if (templates === "true") list = list.filter((r) => r.isTemplate);
    else if (templates === "false") list = list.filter((r) => !r.isTemplate);
    if (level) list = list.filter((r) => r.level === level);

    return NextResponse.json({ presets: list });
  } catch (err) {
    console.error("[admin/presets] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load presets" },
      { status: 500 }
    );
  }
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
  const targetCanvas = body.targetCanvas === "reactflow" || body.targetCanvas === "excalidraw" || body.targetCanvas === "drawio" ? body.targetCanvas : "reactflow";
  const dataFormat = body.dataFormat === "mermaid" || body.dataFormat === "json" ? body.dataFormat : null;
  const mermaidData = typeof body.mermaidData === "string" ? body.mermaidData : null;
  const drawioData = typeof body.drawioData === "string" ? body.drawioData : null;
  const excalidrawData: { elements: unknown[]; appState?: Record<string, unknown> } | null =
    body.excalidrawData && typeof body.excalidrawData === "object" && Array.isArray((body.excalidrawData as { elements?: unknown[] }).elements)
      ? (body.excalidrawData as { elements: unknown[]; appState?: Record<string, unknown> })
      : null;

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
      targetCanvas,
      dataFormat,
      mermaidData,
      drawioData,
      excalidrawData,
    })
    .returning({ id: diagramPresets.id });

  return NextResponse.json({ id: inserted?.id });
}
