/**
 * Load Excalidraw library context for AI prompts (flowchart, system design, etc.)
 */

import fs from "fs/promises";
import path from "path";

const LIBRARY_DIR = path.join(process.cwd(), "docs", "excalidraw-libraries");

/** Available Excalidraw library contexts */
export const EXCALIDRAW_LIBRARIES = ["flowchart", "system-design"] as const;

/** Detect which library to load based on prompt keywords */
export function detectExcalidrawLibraryFromPrompt(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  const map: Record<string, string[]> = {
    "system-design": [
      "system design",
      "architecture",
      "microservice",
      "api",
      "backend",
      "frontend",
      "database",
      "load balancer",
      "cache",
      "queue",
      "cloud",
      "aws",
      "azure",
      "gcp",
    ],
    flowchart: [
      "flowchart",
      "flow chart",
      "process flow",
      "decision",
      "workflow",
      "yes no",
      "start end",
    ],
  };
  for (const [lib, keywords] of Object.entries(map)) {
    if (keywords.some((k) => lower.includes(k))) return lib;
  }
  return null;
}

/** Load library markdown. Returns null if not found. */
export async function loadExcalidrawLibrary(library: string): Promise<string | null> {
  const sanitized = library.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!sanitized) return null;

  const filePath = path.join(LIBRARY_DIR, `${sanitized}.md`);
  const resolved = path.resolve(filePath);
  const baseResolved = path.resolve(LIBRARY_DIR);
  if (!resolved.startsWith(baseResolved)) return null;

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch {
    return null;
  }
}
