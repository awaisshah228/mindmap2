"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { ComponentProps } from "react";
import { useAuth } from "@clerk/nextjs";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  DEFAULT_LIBRARY_URLS,
  getStoredLibraryItems,
  setStoredLibraryItems,
  clearLibrary,
  parseLibraryResponse,
  mergeItems,
  deduplicateItems,
  hasDefaultsSeeded,
  markDefaultsSeeded,
} from "@/lib/excalidraw-library-storage";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, RotateCcw } from "lucide-react";

/** Create a promise whose resolve/reject we can call later (like the Camelot example). */
function resolvablePromise<T>(): Promise<T> & { resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  (promise as Promise<T> & { resolve: (v: T) => void; reject: (e: unknown) => void }).resolve = resolve;
  (promise as Promise<T> & { resolve: (v: T) => void; reject: (e: unknown) => void }).reject = reject;
  return promise as Promise<T> & { resolve: (v: T) => void; reject: (e: unknown) => void };
}

async function loadLibraryItems(): Promise<unknown[]> {
  let items = getStoredLibraryItems();
  if (items.length === 0 && !hasDefaultsSeeded()) {
    for (const url of DEFAULT_LIBRARY_URLS) {
      try {
        const res = await fetch(`/api/excalidraw-library?url=${encodeURIComponent(url)}`);
        if (res.ok) {
          const data = await res.json();
          const parsed = parseLibraryResponse(data);
          items = mergeItems(items, parsed);
        }
      } catch {
        // ignore
      }
    }
    if (items.length > 0) {
      items = deduplicateItems(items);
      setStoredLibraryItems(items);
      markDefaultsSeeded();
    }
  }
  return deduplicateItems(items);
}

/**
 * Excalidraw whiteboard in the same canvas area as React Flow.
 * Loads default libraries from localStorage (or fetches via API on first load).
 * Persists library changes. User can install more libraries via "Add library".
 */
export default function ExcalidrawCanvas() {
  const { isSignedIn } = useAuth();
  const theme = useCanvasStore((s) => s.theme);
  const excalidrawData = useCanvasStore((s) => s.excalidrawData);
  const setExcalidrawData = useCanvasStore((s) => s.setExcalidrawData);
  const setHasUnsavedChanges = useCanvasStore((s) => s.setHasUnsavedChanges);
  const pendingExcalidrawLibraryUrl = useCanvasStore((s) => s.pendingExcalidrawLibraryUrl);
  const setPendingExcalidrawLibraryUrl = useCanvasStore((s) => s.setPendingExcalidrawLibraryUrl);
  const hasUnsavedChanges = useCanvasStore((s) => s.hasUnsavedChanges);
  const saveCurrentProject = useCanvasStore((s) => s.saveCurrentProject);
  const [addLibraryOpen, setAddLibraryOpen] = useState(false);
  const [addLibraryUrl, setAddLibraryUrl] = useState("");
  const [addLibraryError, setAddLibraryError] = useState<string | null>(null);
  const [addLibraryLoading, setAddLibraryLoading] = useState(false);
  const [resetLibraryLoading, setResetLibraryLoading] = useState(false);
  /** Excalidraw API: updateLibrary, updateScene, addFiles (to sync external excalidrawData from AI). */
  const apiRef = useRef<{
    updateLibrary?: (opts: {
      libraryItems: unknown[];
      merge?: boolean;
      prompt?: boolean;
      openLibraryMenu?: boolean;
      defaultStatus?: "unpublished" | "published";
    }) => Promise<unknown>;
    updateScene?: (opts: { elements?: unknown[]; appState?: Record<string, unknown> }) => void;
    addFiles?: (files: Record<string, { mimeType: string; id: string; dataURL: string }>) => void;
    scrollToContent?: (target?: unknown, opts?: { fitToContent?: boolean }) => void;
  } | null>(null);
  const syncingFromStoreRef = useRef(false);

  /** Resolvable promise for libraryItems - resolve when API is ready and items loaded (Camelot pattern). */
  const libraryItemsPromiseRef = useRef<ReturnType<typeof resolvablePromise<unknown[]>> | null>(null);
  if (!libraryItemsPromiseRef.current) {
    libraryItemsPromiseRef.current = resolvablePromise<unknown[]>();
  }

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const initialData = useMemo(() => {
    const raw = excalidrawData?.appState ?? {};
    const appState = {
      ...raw,
      collaborators: Array.isArray(raw.collaborators) ? raw.collaborators : [],
    };
    const hasElements = (excalidrawData?.elements?.length ?? 0) > 0;
    const hasFiles = excalidrawData?.files && Object.keys(excalidrawData.files).length > 0;
    const elements = (excalidrawData?.elements ?? []) as unknown[];
    return {
      elements: hasElements || hasFiles ? elements : [],
      appState,
      files: excalidrawData?.files ?? undefined,
      libraryItems: libraryItemsPromiseRef.current, // Resolvable Promise - resolved when API ready (Camelot pattern)
      scrollToContent: false, // Don't auto-fit — let user pan and zoom freely
    } as unknown as ComponentProps<typeof Excalidraw>["initialData"];
  }, [excalidrawData]);

  const onChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>, files?: Record<string, unknown>) => {
      if (syncingFromStoreRef.current) return;
      const raw = appState ?? {};
      const safeAppState = {
        ...raw,
        collaborators: Array.isArray(raw.collaborators) ? raw.collaborators : [],
      };
      const nextFiles = files != null && typeof files === "object"
        ? (files as Record<string, { mimeType: string; id: string; dataURL: string }>)
        : excalidrawData?.files;
      setExcalidrawData({
        elements: [...elements],
        appState: safeAppState,
        files: nextFiles,
      });
      setHasUnsavedChanges(true);
    },
    [setExcalidrawData, setHasUnsavedChanges, excalidrawData?.files]
  );

  const syncLibraryToCloud = useCallback(
    async (items: unknown[]) => {
      if (!isSignedIn || !Array.isArray(items)) return;
      try {
        const res = await fetch("/api/user/excalidraw-libraries", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ libraryItems: items }),
        });
        if (!res.ok) {
          console.error("[Excalidraw] Cloud sync failed:", res.status, await res.text());
        }
      } catch (e) {
        console.error("[Excalidraw] Cloud sync error:", e);
      }
    },
    [isSignedIn]
  );

  const onLibraryChange = useCallback(
    (libraryItems: unknown[]) => {
      const arr = Array.isArray(libraryItems) ? libraryItems : [];
      const deduped = deduplicateItems(arr);
      setStoredLibraryItems(deduped);
      syncLibraryToCloud(deduped);
    },
    [syncLibraryToCloud]
  );

  const handleAddLibrary = useCallback(async () => {
    const url = addLibraryUrl.trim();
    if (!url) return;
    setAddLibraryError(null);
    setAddLibraryLoading(true);
    try {
      const res = await fetch(`/api/excalidraw-library?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to fetch library");
      }
      const data = await res.json();
      const parsed = parseLibraryResponse(data);
      if (parsed.length === 0) throw new Error("No library items found");
      const current = getStoredLibraryItems();
      const merged = deduplicateItems(mergeItems(current, parsed));
      setStoredLibraryItems(merged);
      syncLibraryToCloud(merged);
      if (!apiRef.current?.updateLibrary) {
        console.error("[Excalidraw] updateLibrary not available; library may not appear in UI");
      } else {
        try {
          await apiRef.current.updateLibrary({ libraryItems: merged, merge: false, prompt: false, openLibraryMenu: true });
        } catch (e) {
          console.error("[Excalidraw] updateLibrary failed:", e);
        }
      }
      setAddLibraryUrl("");
      setAddLibraryOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add library";
      console.error("[Excalidraw] Add library failed:", e);
      setAddLibraryError(msg);
    } finally {
      setAddLibraryLoading(false);
    }
  }, [addLibraryUrl, syncLibraryToCloud]);

  const handleResetLibrary = useCallback(async () => {
    if (!window.confirm("Reset library? This will remove all items from local storage and cloud. Page will reload to apply.")) return;
    setResetLibraryLoading(true);
    try {
      clearLibrary();
      await syncLibraryToCloud([]);
      if (apiRef.current?.updateLibrary) {
        await apiRef.current.updateLibrary({ libraryItems: [], merge: false, prompt: false });
      }
      window.location.reload();
    } catch (e) {
      console.error("[Excalidraw] Reset library failed:", e);
    } finally {
      setResetLibraryLoading(false);
    }
  }, [syncLibraryToCloud]);

  const renderTopRightUI = useCallback(
    (_isMobile: boolean) => (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleResetLibrary}
          disabled={resetLibraryLoading}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          title="Reset library (removes from local and cloud)"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${resetLibraryLoading ? "animate-spin" : ""}`} />
          Reset library
        </button>
        <Dialog.Root open={addLibraryOpen} onOpenChange={setAddLibraryOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/40 dark:hover:bg-violet-800/60 text-violet-700 dark:text-violet-300"
              title="Add Excalidraw library"
            >
              <Plus className="w-3.5 h-3.5" />
              Add library
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-[9999]" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] w-full max-w-md rounded-lg bg-white dark:bg-gray-900 shadow-xl border border-gray-200 dark:border-gray-700 p-4">
              <Dialog.Title className="text-sm font-semibold mb-2">Add Excalidraw library</Dialog.Title>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Paste a library URL (e.g. from{" "}
                <a href="https://libraries.excalidraw.com" target="_blank" rel="noopener noreferrer" className="text-violet-500 underline">
                  libraries.excalidraw.com
                </a>
                )
              </p>
              <input
                type="url"
                value={addLibraryUrl}
                onChange={(e) => setAddLibraryUrl(e.target.value)}
                placeholder="https://cdn.jsdelivr.net/gh/excalidraw/excalidraw-libraries@main/..."
                className="w-full px-3 py-2 text-sm rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 mb-3"
              />
              {addLibraryError && <p className="text-xs text-red-500 mb-2">{addLibraryError}</p>}
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="px-3 py-1.5 text-sm rounded border">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleAddLibrary}
                  disabled={addLibraryLoading || !addLibraryUrl.trim()}
                  className="px-3 py-1.5 text-sm rounded bg-violet-600 text-white disabled:opacity-50"
                >
                  {addLibraryLoading ? "Adding…" : "Add"}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    ),
    [addLibraryOpen, addLibraryUrl, addLibraryError, addLibraryLoading, handleAddLibrary, handleResetLibrary, resetLibraryLoading]
  );

  const excalidrawAPI = useCallback((api: unknown) => {
    const a = api as {
      updateLibrary?: (opts: { libraryItems: unknown[]; merge?: boolean; prompt?: boolean; openLibraryMenu?: boolean; defaultStatus?: "unpublished" | "published" }) => Promise<unknown>;
      updateScene?: (opts: { elements?: unknown[]; appState?: Record<string, unknown> }) => void;
      addFiles?: (files: Record<string, { mimeType: string; id: string; dataURL: string }>) => void;
      scrollToContent?: (target?: unknown, opts?: { fitToContent?: boolean }) => void;
      library?: { updateLibrary?: (opts: { libraryItems: unknown[]; merge?: boolean; prompt?: boolean; openLibraryMenu?: boolean; defaultStatus?: "unpublished" | "published" }) => Promise<unknown> };
    };
    apiRef.current = (a?.updateLibrary || a?.updateScene ? a : a?.library) ?? null;
    // Resolve libraryItems promise when API is ready (Camelot pattern) - Excalidraw awaits this
    loadLibraryItems()
      .then((items) => {
        libraryItemsPromiseRef.current?.resolve(items);
        // Also call updateLibrary so library UI is populated once API is ready
        if (items.length > 0 && apiRef.current?.updateLibrary) {
          apiRef.current.updateLibrary({ libraryItems: items, merge: false, prompt: false });
        }
      })
      .catch((e) => libraryItemsPromiseRef.current?.reject(e));
  }, []);

  // Sync excalidrawData from store to scene when it changes externally (e.g. AI generation).
  // initialData is only used on mount; updateScene is needed for programmatic updates.
  const applyStoreToScene = useCallback(() => {
    if (!excalidrawData?.elements?.length) return false;
    const api = apiRef.current;
    if (!api?.updateScene) return false;
    syncingFromStoreRef.current = true;
    try {
      // Add image files first if present (required for image elements)
      const files = excalidrawData.files && typeof excalidrawData.files === "object" ? excalidrawData.files : undefined;
      if (files && Object.keys(files).length > 0 && api.addFiles) {
        api.addFiles(files);
      }
      const appState = excalidrawData.appState ?? {};
      const hasViewState =
        typeof (appState as Record<string, unknown>).scrollX === "number" &&
        typeof (appState as Record<string, unknown>).scrollY === "number" &&
        (appState as Record<string, unknown>).zoom != null;
      api.updateScene({
        elements: excalidrawData.elements,
        ...(hasViewState ? { appState } : {}),
      });
      // Move viewport to show the diagram; user can pan/zoom freely after
      if (typeof api.scrollToContent === "function") {
        api.scrollToContent(undefined, { fitToContent: true });
      }
      return true;
    } finally {
      setTimeout(() => { syncingFromStoreRef.current = false; }, 0);
    }
  }, [excalidrawData]);

  useEffect(() => {
    if (!excalidrawData?.elements?.length) return;
    // Apply immediately if API is ready
    if (apiRef.current?.updateScene) {
      applyStoreToScene();
      return;
    }
    // API may not be ready yet (e.g. Excalidraw still mounting). Retry until ready.
    let attempts = 0;
    const maxAttempts = 30;
    const id = setInterval(() => {
      attempts++;
      if (apiRef.current?.updateScene) {
        clearInterval(id);
        applyStoreToScene();
      } else if (attempts >= maxAttempts) {
        clearInterval(id);
      }
    }, 100);
    return () => clearInterval(id);
  }, [excalidrawData, applyStoreToScene]);

  // Load cloud libraries when signed in and merge with local
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 50 && !apiRef.current && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled || !apiRef.current) return;
      try {
        const res = await fetch("/api/user/excalidraw-libraries", { credentials: "include" });
        if (!res.ok || cancelled) {
          if (!res.ok) console.error("[Excalidraw] Failed to load cloud libraries:", res.status);
          return;
        }
        const data = await res.json();
        const cloudItems = Array.isArray(data.libraryItems) ? data.libraryItems : [];
        if (cloudItems.length === 0) return;
        const local = getStoredLibraryItems();
        const merged = deduplicateItems(mergeItems(local, cloudItems));
        setStoredLibraryItems(merged);
        if (!cancelled && apiRef.current?.updateLibrary) {
          try {
            await apiRef.current.updateLibrary({ libraryItems: merged, merge: false, prompt: false });
          } catch (e) {
            console.error("[Excalidraw] updateLibrary (cloud merge) failed:", e);
          }
        } else if (!apiRef.current?.updateLibrary) {
          console.error("[Excalidraw] updateLibrary not available when loading cloud libraries");
        }
      } catch (e) {
        console.error("[Excalidraw] Load cloud libraries error:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  // Install library from #addLibrary redirect: wait for API, then show confirm, then install
  useEffect(() => {
    if (!pendingExcalidrawLibraryUrl) return;
    const url = pendingExcalidrawLibraryUrl;
    let cancelled = false;
    (async () => {
      // Wait for Excalidraw API to be ready
      for (let i = 0; i < 50 && !apiRef.current && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (cancelled || !apiRef.current) return;
      const ok = window.confirm(
        hasUnsavedChanges
          ? "Add this Excalidraw library? Your current work will be saved first."
          : "Add this Excalidraw library?"
      );
      if (!ok || cancelled) {
        if (!cancelled) {
          setPendingExcalidrawLibraryUrl(null);
          const search = window.location.search?.slice(1) || "";
          const hash = window.location.hash?.slice(1) || "";
          const queryParams = new URLSearchParams(search);
          const hashParams = new URLSearchParams(hash);
          queryParams.delete("addLibrary");
          hashParams.delete("addLibrary");
          const qs = queryParams.toString();
          const hs = hashParams.toString();
          window.history.replaceState(
            null,
            "",
            window.location.pathname + (qs ? `?${qs}` : "") + (hs ? `#${hs}` : "")
          );
        }
        return;
      }
      if (hasUnsavedChanges) saveCurrentProject();
      try {
        const res = await fetch(`/api/excalidraw-library?url=${encodeURIComponent(url)}`);
        if (!res.ok) {
          const errText = await res.text();
          console.error("[Excalidraw] addLibrary fetch failed:", res.status, errText);
          throw new Error("Failed to fetch library");
        }
        const data = await res.json();
        const parsed = parseLibraryResponse(data);
        if (parsed.length === 0) {
          console.error("[Excalidraw] addLibrary: no library items parsed from response");
        } else {
          const current = getStoredLibraryItems();
          const merged = deduplicateItems(mergeItems(current, parsed));
          setStoredLibraryItems(merged);
          try {
            const cloudRes = await fetch("/api/user/excalidraw-libraries", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ libraryItems: merged }),
            });
            if (!cloudRes.ok) {
              console.error("[Excalidraw] addLibrary cloud sync failed:", cloudRes.status);
            }
          } catch (e) {
            console.error("[Excalidraw] addLibrary cloud sync error:", e);
          }
          if (!apiRef.current?.updateLibrary) {
            console.error("[Excalidraw] addLibrary: updateLibrary not available; library saved but may not appear in UI");
          } else {
            try {
              await apiRef.current.updateLibrary({ libraryItems: merged, merge: false, prompt: false, openLibraryMenu: true });
            } catch (e) {
              console.error("[Excalidraw] addLibrary updateLibrary failed:", e);
            }
          }
        }
      } catch (e) {
        console.error("[Excalidraw] addLibrary error:", e);
      } finally {
        if (!cancelled) {
          setPendingExcalidrawLibraryUrl(null);
          if (typeof window === "undefined") return;
          const search = window.location.search?.slice(1) || "";
          const hash = window.location.hash?.slice(1) || "";
          const queryParams = new URLSearchParams(search);
          const hashParams = new URLSearchParams(hash);
          queryParams.delete("addLibrary");
          hashParams.delete("addLibrary");
          const qs = queryParams.toString();
          const hs = hashParams.toString();
          const newSearch = qs ? `?${qs}` : "";
          const newHash = hs ? `#${hs}` : "";
          window.history.replaceState(null, "", window.location.pathname + newSearch + newHash);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pendingExcalidrawLibraryUrl, setPendingExcalidrawLibraryUrl, hasUnsavedChanges, saveCurrentProject]);

  const libraryReturnUrl = typeof window !== "undefined" ? `${window.location.origin}/editor` : "/editor";

  return (
    <div id="excalidraw-canvas-export" className="absolute inset-0 w-full h-full bg-white dark:bg-gray-900">
      <Excalidraw
        theme={isDark ? "dark" : "light"}
        initialData={initialData as ComponentProps<typeof Excalidraw>["initialData"]}
        onChange={onChange as unknown as ComponentProps<typeof Excalidraw>["onChange"]}
        onLibraryChange={onLibraryChange as ComponentProps<typeof Excalidraw>["onLibraryChange"]}
        excalidrawAPI={excalidrawAPI as ComponentProps<typeof Excalidraw>["excalidrawAPI"]}
        renderTopRightUI={renderTopRightUI as ComponentProps<typeof Excalidraw>["renderTopRightUI"]}
        libraryReturnUrl={libraryReturnUrl}
        aiEnabled={true}
        detectScroll={true}
      />
    </div>
  );
}
