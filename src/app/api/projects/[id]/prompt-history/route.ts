import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { documents, diagramPromptHistory } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

/** GET /api/projects/[id]/prompt-history – list all prompts used for this project (newest first). */
export async function GET(_request: NextRequest, { params }: Params) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const { id: documentId } = await params;

  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const list = await db
    .select()
    .from(diagramPromptHistory)
    .where(eq(diagramPromptHistory.documentId, documentId))
    .orderBy(desc(diagramPromptHistory.createdAt));

  const items = list.map((row) => ({
    id: row.id,
    prompt: row.prompt,
    nodes: row.nodes ?? [],
    edges: row.edges ?? [],
    targetCanvas: row.targetCanvas ?? undefined,
    nodeCount: row.nodeCount ?? undefined,
    edgeCount: row.edgeCount ?? undefined,
    createdAt: row.createdAt ? new Date(row.createdAt).getTime() : undefined,
  }));

  return NextResponse.json(items);
}

/** POST /api/projects/[id]/prompt-history – add a prompt + diagram to history. */
export async function POST(request: Request, { params }: Params) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const { id: documentId } = await params;

  const [doc] = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: {
    prompt?: string;
    nodes?: object[];
    edges?: object[];
    targetCanvas?: string;
    nodeCount?: number;
    edgeCount?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.prompt || typeof body.prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const [inserted] = await db
    .insert(diagramPromptHistory)
    .values({
      userId,
      documentId,
      prompt: body.prompt.trim(),
      nodes: body.nodes ?? [],
      edges: body.edges ?? [],
      targetCanvas: body.targetCanvas ?? null,
      nodeCount: body.nodeCount ?? null,
      edgeCount: body.edgeCount ?? null,
    })
    .returning();

  if (!inserted) {
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    id: inserted.id,
    prompt: inserted.prompt,
    nodes: inserted.nodes ?? [],
    edges: inserted.edges ?? [],
    targetCanvas: inserted.targetCanvas ?? undefined,
    nodeCount: inserted.nodeCount ?? undefined,
    edgeCount: inserted.edgeCount ?? undefined,
    createdAt: inserted.createdAt ? new Date(inserted.createdAt).getTime() : undefined,
  });
}
