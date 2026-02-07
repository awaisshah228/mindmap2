/**
 * Match node labels to admin-uploaded cloud icons during AI diagram generation.
 * Fetches /api/icons and assigns customIcon when node label matches icon name or keywords.
 */

export type CloudIcon = { id: string; name: string; keywords: string; url: string };

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function findMatchingCloudIcon(
  label: string,
  icons: CloudIcon[]
): CloudIcon | null {
  const terms = normalize(label);
  if (terms.length === 0) return null;

  const labelLower = label.toLowerCase().trim();

  // Exact name match first
  for (const ic of icons) {
    if (ic.name.toLowerCase().trim() === labelLower) return ic;
  }

  // Any term matches icon name (exact or as word, e.g. "Redis" matches icon "Redis", "Redis Cache")
  for (const ic of icons) {
    const nameLower = ic.name.toLowerCase();
    for (const t of terms) {
      if (nameLower === t || nameLower.startsWith(`${t} `) || nameLower.includes(` ${t} `) || nameLower.endsWith(` ${t}`)) return ic;
    }
  }

  // Keywords: comma-separated, each keyword matched against terms
  const kwMap = new Map<string, CloudIcon[]>();
  for (const ic of icons) {
    const kws = (ic.keywords || "").split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    for (const kw of kws) {
      if (!kwMap.has(kw)) kwMap.set(kw, []);
      kwMap.get(kw)!.push(ic);
    }
  }
  for (const t of terms) {
    const candidates = kwMap.get(t);
    if (candidates && candidates.length > 0) return candidates[0];
    // Partial: keyword contains term or vice versa
    for (const [kw, cands] of kwMap) {
      if (kw.includes(t) || t.includes(kw)) return cands[0];
    }
  }

  return null;
}

export type NodeWithData = { id: string; type?: string; data?: Record<string, unknown>; [k: string]: unknown };

/**
 * Fetches cloud icons and applies customIcon to nodes whose label matches icon name/keywords.
 * Only updates nodes that don't already have customIcon or iconUrl.
 */
export async function applyCloudIconMatching(
  nodes: NodeWithData[],
  baseUrl = ""
): Promise<NodeWithData[]> {
  let icons: CloudIcon[] = [];
  try {
    const res = await fetch(`${baseUrl || (typeof window !== "undefined" ? window.location.origin : "")}/api/icons`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      icons = data.icons ?? [];
    }
  } catch {
    // ignore
  }
  if (icons.length === 0) return nodes;

  return nodes.map((n) => {
    const data = n.data ?? {};
    const label = (data.label as string) ?? "";
    if (!label || typeof label !== "string") return n;
    if (data.customIcon || data.iconUrl) return n; // already has icon

    const match = findMatchingCloudIcon(label, icons);
    if (!match) return n;

    return {
      ...n,
      data: { ...data, customIcon: match.url },
    };
  });
}
