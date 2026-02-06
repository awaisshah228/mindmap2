"use client";

import { useCallback } from "react";
import type { ComponentProps } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useCanvasStore } from "@/lib/store/canvas-store";

/**
 * Excalidraw whiteboard in the same canvas area as React Flow.
 * Load this with next/dynamic (ssr: false) from EditorLayout.
 * Uses excalidrawData from store for initialData and persists changes via onChange.
 */
export default function ExcalidrawCanvas() {
  const theme = useCanvasStore((s) => s.theme);
  const excalidrawData = useCanvasStore((s) => s.excalidrawData);
  const setExcalidrawData = useCanvasStore((s) => s.setExcalidrawData);
  const setHasUnsavedChanges = useCanvasStore((s) => s.setHasUnsavedChanges);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const initialData = (() => {
    if (!excalidrawData) return undefined;
    const hasElements = (excalidrawData.elements?.length ?? 0) > 0;
    const hasFiles = excalidrawData.files && Object.keys(excalidrawData.files).length > 0;
    if (!hasElements && !hasFiles) return undefined;
    const raw = excalidrawData.appState ?? {};
    const appState = {
      ...raw,
      collaborators: Array.isArray(raw.collaborators) ? raw.collaborators : [],
    };
    return {
      elements: excalidrawData.elements ?? [],
      appState,
      files: excalidrawData.files ?? undefined,
      scrollToContent: true,
    };
  })();

  const onChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>, files?: Record<string, unknown>) => {
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

  return (
    <div id="excalidraw-canvas-export" className="absolute inset-0 w-full h-full bg-white dark:bg-gray-900">
      <Excalidraw
        theme={isDark ? "dark" : "light"}
        initialData={initialData as ComponentProps<typeof Excalidraw>["initialData"]}
        onChange={onChange as unknown as ComponentProps<typeof Excalidraw>["onChange"]}
      />
    </div>
  );
}
