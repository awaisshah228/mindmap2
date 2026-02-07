import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/db";
import { cloudIcons } from "@/db/schema";

/** DELETE /api/admin/icons/[id] – delete cloud icon (admin only). */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await requireAdmin();
  if (ok instanceof NextResponse) return ok;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID required" }, { status: 400 });
  }

  try {
    await db.delete(cloudIcons).where(eq(cloudIcons.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin delete icon error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
