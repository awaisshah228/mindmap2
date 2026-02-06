import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

/** GET /api/projects/[id] – get one document. */
export async function GET(_request: Request, { params }: Params) {
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

  return NextResponse.json({
    id: doc.id,
    name: doc.name,
    nodes: doc.nodes ?? [],
    edges: doc.edges ?? [],
    viewport: doc.viewport ?? undefined,
    nodeNotes: doc.nodeNotes ?? {},
    nodeTasks: doc.nodeTasks ?? {},
    nodeAttachments: doc.nodeAttachments ?? {},
    isFavorite: doc.isFavorite ?? false,
    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).getTime() : Date.now(),
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
    nodeNotes?: Record<string, string>;
    nodeTasks?: Record<string, unknown>;
    nodeAttachments?: Record<string, unknown>;
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
      ...(body.nodeNotes !== undefined && { nodeNotes: body.nodeNotes }),
      ...(body.nodeTasks !== undefined && { nodeTasks: body.nodeTasks }),
      ...(body.nodeAttachments !== undefined && { nodeAttachments: body.nodeAttachments }),
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
    nodeNotes: updated.nodeNotes ?? {},
    nodeTasks: updated.nodeTasks ?? {},
    nodeAttachments: updated.nodeAttachments ?? {},
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
