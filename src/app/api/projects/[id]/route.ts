import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

/** Chunk size for streaming project JSON – large enough to avoid tiny backend writes. */
const STREAM_CHUNK_SIZE = 8192;

/** GET /api/projects/[id] – get one document. Use ?stream=1 to stream JSON for large projects. */
export async function GET(request: NextRequest, { params }: Params) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)));

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = {
    id: doc.id,
    name: doc.name,
    nodes: doc.nodes ?? [],
    edges: doc.edges ?? [],
    viewport: doc.viewport ?? undefined,
    savedLayout: doc.savedLayout ?? undefined,
    nodeNotes: doc.nodeNotes ?? {},
    nodeTasks: doc.nodeTasks ?? {},
    nodeAttachments: doc.nodeAttachments ?? {},
    excalidrawData: doc.excalidrawData ?? undefined,
    drawioData: doc.drawioData ?? undefined,
    isFavorite: doc.isFavorite ?? false,
    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).getTime() : Date.now(),
  };

  const stream = request.nextUrl.searchParams.get("stream") === "1";
  if (!stream) {
    return NextResponse.json(payload);
  }

  const jsonStr = JSON.stringify(payload);
  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < jsonStr.length; i += STREAM_CHUNK_SIZE) {
        controller.enqueue(encoder.encode(jsonStr.slice(i, i + STREAM_CHUNK_SIZE)));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/** PATCH /api/projects/[id] – update document. */
export async function PATCH(request: Request, { params }: Params) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;
  let body: {
    name?: string;
    nodes?: object[];
    edges?: object[];
    viewport?: { x: number; y: number; zoom: number };
    savedLayout?: { direction: string; algorithm: string; spacingX: number; spacingY: number };
    nodeNotes?: Record<string, string>;
    nodeTasks?: Record<string, unknown>;
    nodeAttachments?: Record<string, unknown>;
    excalidrawData?: { elements: unknown[]; appState?: Record<string, unknown> } | null;
    drawioData?: string | null;
    isFavorite?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const [updated] = await db
    .update(documents)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.nodes !== undefined && { nodes: body.nodes }),
      ...(body.edges !== undefined && { edges: body.edges }),
      ...(body.viewport !== undefined && { viewport: body.viewport }),
      ...(body.savedLayout !== undefined && { savedLayout: body.savedLayout }),
      ...(body.nodeNotes !== undefined && { nodeNotes: body.nodeNotes }),
      ...(body.nodeTasks !== undefined && { nodeTasks: body.nodeTasks }),
      ...(body.nodeAttachments !== undefined && { nodeAttachments: body.nodeAttachments }),
      ...(body.excalidrawData !== undefined && { excalidrawData: body.excalidrawData }),
      ...(body.drawioData !== undefined && { drawioData: body.drawioData }),
      ...(body.isFavorite !== undefined && { isFavorite: body.isFavorite }),
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    nodes: updated.nodes ?? [],
    edges: updated.edges ?? [],
    viewport: updated.viewport ?? undefined,
    savedLayout: updated.savedLayout ?? undefined,
    nodeNotes: updated.nodeNotes ?? {},
    nodeTasks: updated.nodeTasks ?? {},
    nodeAttachments: updated.nodeAttachments ?? {},
    excalidrawData: updated.excalidrawData ?? undefined,
    drawioData: updated.drawioData ?? undefined,
    isFavorite: updated.isFavorite ?? false,
    createdAt: updated.createdAt ? new Date(updated.createdAt).getTime() : Date.now(),
    updatedAt: updated.updatedAt ? new Date(updated.updatedAt).getTime() : Date.now(),
  });
}

/** DELETE /api/projects/[id] – delete document. */
export async function DELETE(_request: Request, { params }: Params) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;
  const { id } = await params;

  const [deleted] = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning({ id: documents.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
