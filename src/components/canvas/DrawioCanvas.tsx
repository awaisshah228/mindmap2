"use client";

import { useCallback, useMemo } from "react";
import { DrawIoEmbed } from "react-drawio";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useDrawio } from "@/contexts/DrawioContext";
import { validateAndFixXml } from "@/lib/drawio-utils";

/**
 * Draw.io embed in the same canvas area as React Flow and Excalidraw.
 * Load with next/dynamic (ssr: false). Persists XML via onSave/onAutoSave.
 * Uses validateAndFixXml (next-ai-draw-io style) before loading.
 * On mobile: uses minimal UI (format=0, ui=min) so canvas gets space.
 */
export default function DrawioCanvas() {
  const { drawioRef } = useDrawio();
  const drawioData = useCanvasStore((s) => s.drawioData);
  const setDrawioData = useCanvasStore((s) => s.setDrawioData);
  const setHasUnsavedChanges = useCanvasStore((s) => s.setHasUnsavedChanges);
  const theme = useCanvasStore((s) => s.theme);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Validate and fix XML before passing to embed (next-ai-draw-io pattern)
  const xmlToLoad = useMemo(() => {
    if (!drawioData) return undefined;
    const v = validateAndFixXml(drawioData);
    return v.fixed ?? drawioData;
  }, [drawioData]);

  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const handleSave = useCallback(
    (data: { xml: string }) => {
      if (data?.xml) {
        setDrawioData(data.xml);
        setHasUnsavedChanges(true);
      }
    },
    [setDrawioData, setHasUnsavedChanges]
  );

  const handleAutoSave = useCallback(
    (data: { xml: string }) => {
      if (data?.xml) {
        setDrawioData(data.xml);
        setHasUnsavedChanges(true);
      }
    },
    [setDrawioData, setHasUnsavedChanges]
  );

  const uiValue = isMobile ? "min" : isDark ? "dark" : "kennedy";
  const urlParameters = {
    ui: uiValue as "min" | "dark" | "kennedy",
    dark: isDark,
    spin: true,
    libraries: true,
    saveAndExit: false,
    ...(isMobile && {
      format: 0, // Hide right format panel on mobile to free canvas space
    }),
  };

  return (
    <div id="drawio-canvas-export" className="absolute inset-0 w-full h-full bg-white dark:bg-gray-900">
      <DrawIoEmbed
        ref={drawioRef}
        xml={xmlToLoad}
        autosave
        onSave={handleSave}
        onAutoSave={handleAutoSave}
        urlParameters={urlParameters}
      />
    </div>
  );
}
