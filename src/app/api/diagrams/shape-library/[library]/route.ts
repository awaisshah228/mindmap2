/**
 * Get Draw.io shape library documentation by name.
 * Mirrors next-ai-draw-io get_shape_library tool for on-demand library fetch.
 */

import { NextRequest, NextResponse } from "next/server";
import { loadShapeLibrary, SHAPE_LIBRARIES } from "@/lib/shape-library";

const AVAILABLE = SHAPE_LIBRARIES.join(", ");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ library: string }> }
) {
  try {
    const { library } = await params;
    if (!library || typeof library !== "string") {
      return NextResponse.json(
        { error: "Library name required" },
        { status: 400 }
      );
    }

    const content = await loadShapeLibrary(library);
    if (!content) {
      return NextResponse.json(
        { error: `Library "${library}" not found. Available: ${AVAILABLE}` },
        { status: 404 }
      );
    }

    return new Response(content, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  } catch (err) {
    console.error("[shape-library] Error:", err);
    return NextResponse.json(
      { error: "Failed to load shape library" },
      { status: 500 }
    );
  }
}
