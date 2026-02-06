/**
 * Load Draw.io shape library documentation.
 * Used to inject library-specific guidance into the Draw.io AI prompt.
 * Based on next-ai-draw-io: https://github.com/DayuanJiang/next-ai-draw-io
 */

import fs from "fs/promises";
import path from "path";

const LIBRARY_DIR = path.join(process.cwd(), "docs", "shape-libraries");

/** Available libraries matching next-ai-draw-io */
export const SHAPE_LIBRARIES = [
  "aws4",
  "azure2",
  "gcp2",
  "alibaba_cloud",
  "openstack",
  "salesforce",
  "cisco19",
  "network",
  "kubernetes",
  "vvd",
  "rack",
  "bpmn",
  "lean_mapping",
  "flowchart",
  "basic",
  "arrows2",
  "infographic",
  "sitemap",
  "android",
  "citrix",
  "sap",
  "mscae",
  "atlassian",
  "fluidpower",
  "electrical",
  "pid",
  "cabinets",
  "floorplan",
  "webicons",
] as const;

/** Detect which library to load based on user prompt keywords */
export function detectLibraryFromPrompt(prompt: string): string | null {
  const lower = prompt.toLowerCase();
  const map: Record<string, string[]> = {
    aws4: ["aws", "amazon web", "ec2", "s3", "lambda", "rds", "dynamodb", "cloudfront"],
    azure2: ["azure", "microsoft cloud"],
    gcp2: ["gcp", "google cloud", "gke", "bigquery"],
    kubernetes: ["kubernetes", "k8s", "pod", "cluster"],
    flowchart: ["flowchart", "flow chart", "process flow", "decision"],
    bpmn: ["bpmn", "business process", "workflow", "swimlane"],
    network: ["network", "topology", "router", "firewall", "vpc"],
    basic: ["diagram", "generic", "simple"],
  };
  for (const [lib, keywords] of Object.entries(map)) {
    if (keywords.some((k) => lower.includes(k))) return lib;
  }
  return null;
}

/** Load shape library markdown. Returns null if not found. */
export async function loadShapeLibrary(library: string): Promise<string | null> {
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
