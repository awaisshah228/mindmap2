/**
 * Excalidraw library storage in localStorage.
 * Stores merged library items. Default global libraries are fetched on first load.
 */

const STORAGE_KEY = "ai-diagram-excalidraw-libraries";
const DEFAULTS_SEEDED_KEY = "ai-diagram-excalidraw-defaults-seeded";

/** Default global libraries: most-used for system design. Loaded on Excalidraw mount. Use API route to fetch (avoids CORS). */
export const DEFAULT_LIBRARY_URLS = [
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/youritjang/software-architecture.excalidrawlib",
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/inwardmovement/information-architecture.excalidrawlib",
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/rohanp/system-design.excalidrawlib",
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/drwnio/drwnio.excalidrawlib",
  "https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/cloud/cloud.excalidrawlib",
] as const;

/** Extra library URLs from env. Set NEXT_PUBLIC_EXCALIDRAW_EXTRA_LIBRARY_URLS (comma-separated) in .env.local to add your custom libraries. */
function getExtraLibraryUrls(): string[] {
  if (typeof process === "undefined" || !process.env) return [];
  const raw = process.env.NEXT_PUBLIC_EXCALIDRAW_EXTRA_LIBRARY_URLS ?? "";
  return raw.split(",").map((u) => u.trim()).filter(Boolean);
}

/** All library URLs to load: defaults + your custom libraries from env. */
export function getLibraryUrlsToLoad(): string[] {
  return [...DEFAULT_LIBRARY_URLS, ...getExtraLibraryUrls()];
}

/** Get stored library items from localStorage */
export function getStoredLibraryItems(): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Save library items to localStorage */
export function setStoredLibraryItems(items: unknown[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("[excalidraw-library-storage] Failed to save:", e);
  }
}

/** Extract libraryItems from .excalidrawlib JSON response */
export function parseLibraryResponse(data: unknown): unknown[] {
  const obj = data as Record<string, unknown>;
  const items = (obj.libraryItems ?? obj.library) as unknown[] | undefined;
  return Array.isArray(items) ? items : [];
}

/** Get a stable fingerprint for an item (for deduplication). Excalidraw items can be objects with id or arrays of elements. */
function getItemFingerprint(item: unknown): string {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    const id = (item as Record<string, unknown>)?.id;
    if (id != null) return `id:${String(id)}`;
  }
  if (Array.isArray(item) && item.length > 0) {
    const ids = item
      .map((el) => (el && typeof el === "object" && "id" in el ? String((el as { id?: string }).id) : ""))
      .filter(Boolean);
    if (ids.length > 0) return `arr:${ids.join(",")}`;
  }
  try {
    const str = JSON.stringify(item);
    return `hash:${str.length}:${str.slice(0, 120)}`;
  } catch {
    return `rand:${Math.random()}`;
  }
}

/** Content-based fingerprint: same shape/structure = same fingerprint, even if IDs differ. Catches similar data. Falls back to id-based when content is empty. */
function getContentFingerprint(item: unknown): string {
  if (!item || typeof item !== "object") return String(item);
  const extract = (el: unknown): string => {
    if (!el || typeof el !== "object") return "";
    const o = el as Record<string, unknown>;
    const type = String(o.type ?? "");
    const x = Math.round(Number(o.x ?? 0));
    const y = Math.round(Number(o.y ?? 0));
    const w = Math.round(Number(o.width ?? 0));
    const h = Math.round(Number(o.height ?? 0));
    const stroke = String(o.strokeColor ?? "");
    const fill = String(o.backgroundColor ?? o.fillStyle ?? "");
    return `${type}:${x},${y}:${w}x${h}:${stroke}:${fill}`;
  };
  let content: string;
  if (Array.isArray(item)) {
    const parts = item.map(extract).filter(Boolean);
    parts.sort();
    content = parts.join("|");
  } else {
    content = extract(item);
  }
  if (content) return `content:${content}`;
  return getItemFingerprint(item);
}

/** Merge new items into existing, deduping by id and content. Avoids duplicates and similar data when merging cloud + local. */
export function mergeItems(existing: unknown[], incoming: unknown[]): unknown[] {
  const byContent = new Map<string, unknown>();
  const add = (item: unknown) => {
    const contentFp = getContentFingerprint(item);
    if (!byContent.has(contentFp)) byContent.set(contentFp, item);
  };
  for (const item of existing) add(item);
  for (const item of incoming) add(item);
  return Array.from(byContent.values());
}

/** Deduplicate items by id and content. Use when merging cloud + local or before saving. Prevents similar data in local and cloud. */
export function deduplicateItems(items: unknown[]): unknown[] {
  const byContent = new Map<string, unknown>();
  for (const item of items) {
    const contentFp = getContentFingerprint(item);
    if (!byContent.has(contentFp)) byContent.set(contentFp, item);
  }
  return Array.from(byContent.values());
}

/** Check if default libraries have been seeded */
export function hasDefaultsSeeded(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEFAULTS_SEEDED_KEY) === "1";
}

export function markDefaultsSeeded(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEFAULTS_SEEDED_KEY, "1");
}

/** Clear stored library and defaults-seeded flag. Call when resetting library so next load can re-seed defaults. */
export function clearLibrary(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DEFAULTS_SEEDED_KEY);
  } catch (e) {
    console.warn("[excalidraw-library-storage] Failed to clear:", e);
  }
}
