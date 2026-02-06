import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/** GET /api/projects – list current user's documents (projects). */
export async function GET() {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

  const list = await db
    .select()
    .from(documents)
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.updatedAt));

  const projects = list.map((doc) => ({
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
  }));

  return NextResponse.json(projects);
}

/** POST /api/projects – create a new document (project). */
export async function POST(request: Request) {
  const userId = await requireAuth();
  if (userId instanceof NextResponse) return userId;

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
    // empty body is ok
  }

  const [doc] = await db
    .insert(documents)
    .values({
      userId,
      name: body.name ?? "Untitled",
      nodes: body.nodes ?? [],
      edges: body.edges ?? [],
      viewport: body.viewport ?? null,
      nodeNotes: body.nodeNotes ?? {},
      nodeTasks: body.nodeTasks ?? {},
      nodeAttachments: body.nodeAttachments ?? {},
      isFavorite: body.isFavorite ?? false,
    })
    .returning();

  if (!doc) {
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
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
