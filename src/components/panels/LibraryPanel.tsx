"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Search, Image, FolderOpen, Loader2 } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { setDragPayload } from "@/lib/dnd-payload";

type LibraryFile = { key: string; url: string; filename?: string; mimeType?: string };

export function LibraryPanel() {
  const libraryOpen = useCanvasStore((s) => s.libraryOpen);
  const setLibraryOpen = useCanvasStore((s) => s.setLibraryOpen);
  const setPendingEmoji = useCanvasStore((s) => s.setPendingEmoji);
  const setPendingImage = useCanvasStore((s) => s.setPendingImage);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const { isSignedIn } = useAuth();

  const [files, setFiles] = useState<LibraryFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadFiles = useCallback(() => {
    if (!libraryOpen || !isSignedIn) return;
    setLoading(true);
    fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/upload?folder=all`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { files: [] }))
      .then((d) => setFiles(d.files ?? []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [libraryOpen, isSignedIn]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const filtered = search.trim()
    ? files.filter((f) => (f.filename ?? f.key).toLowerCase().includes(search.trim().toLowerCase()))
    : files;

  if (!libraryOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] bg-black/30">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[480px] max-w-[90vw] max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-violet-500" />
            Your library
          </h2>
          <button
            type="button"
            onClick={() => setLibraryOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!isSignedIn ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
            Sign in to see your uploaded icons and images from S3.
          </div>
        ) : (
          <>
            <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search your uploads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400 text-sm">
                  {files.length === 0
                    ? "No uploads yet. Use Icons & images in the toolbar to upload icons or images to S3."
                    : "No matches for your search."}
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-3">
                  {filtered.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        const isImg = f.mimeType?.startsWith("image/");
                        setDragPayload(e.dataTransfer, isImg
                          ? { type: "icon", data: { customIcon: f.url, label: f.filename ?? undefined } }
                          : { type: "image", data: { imageUrl: f.url, label: f.filename ?? "Image" } });
                      }}
                      onClick={() => {
                        const isImg = f.mimeType?.startsWith("image/");
                        const st = useCanvasStore.getState();
                        if (isImg) {
                          st.setPendingIconId(null);
                          setPendingEmoji(null);
                          setPendingImage(null);
                          st.setPendingCustomIcon(f.url);
                          setActiveTool("emoji");
                        } else {
                          setPendingImage(f.url, f.filename ?? "Image");
                          st.setPendingIconId(null);
                          setPendingEmoji(null);
                          setActiveTool("image");
                        }
                        setLibraryOpen(false);
                      }}
                      className="flex flex-col items-center justify-center h-20 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors overflow-hidden"
                      title={`${f.filename ?? "File"} (click or drag to canvas)`}
                    >
                      {f.mimeType?.startsWith("image/") ? (
                        <img src={f.url} alt={f.filename ?? "User icon"} className="w-10 h-10 object-contain" draggable={false} />
                      ) : (
                        <Image className="w-8 h-8 text-gray-400" />
                      )}
                      <span className="text-[10px] truncate w-full px-1 mt-1 text-gray-600 dark:text-gray-400">{f.filename ?? "File"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
