/**
 * Local user icons/images storage (localStorage).
 * Used when not using S3/API upload - stores data URLs so they persist across sessions
 * and appear in the side toolbar's "My library" section.
 */

const STORAGE_KEY = "ai-diagram-local-user-icons-v1";
const MAX_ITEMS = 50;

export interface LocalUserIconItem {
  key: string;
  url: string; // data URL or any URL
  filename?: string;
  mimeType?: string;
}

function loadFromStorage(): LocalUserIconItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: LocalUserIconItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota exceeded
  }
}

/** Get all locally stored user icons. */
export function getLocalUserIcons(): LocalUserIconItem[] {
  return loadFromStorage();
}

/** Add an icon/image to local storage. Prepends and evicts oldest if over limit. */
export function addLocalUserIcon(item: Omit<LocalUserIconItem, "key">): LocalUserIconItem[] {
  const key = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const full: LocalUserIconItem = { ...item, key };
  const items = loadFromStorage();
  const next = [full, ...items].slice(0, MAX_ITEMS);
  saveToStorage(next);
  return next;
}
