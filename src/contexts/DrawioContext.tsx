"use client";

/**
 * Draw.io diagram context (adapted from next-ai-draw-io DiagramContext).
 * Provides loadDiagram with validateAndFixXml, drawioRef for imperative control,
 * and isRealDiagram for export/save decisions.
 */

import type React from "react";
import { createContext, useCallback, useContext, useRef } from "react";
import type { DrawIoEmbedRef } from "react-drawio";
import { useCanvasStore } from "@/lib/store/canvas-store";
import {
  isRealDiagram,
  validateAndFixXml,
} from "@/lib/drawio-utils";

interface DrawioContextType {
  /** Load diagram XML with validation and auto-fix. Returns error message or null. */
  loadDiagram: (chart: string, skipValidation?: boolean) => string | null;
  /** Ref for imperative DrawIoEmbed control (load, export) */
  drawioRef: React.RefObject<DrawIoEmbedRef | null>;
  /** Check if diagram has real content (not empty template) */
  isRealDiagram: (xml: string | undefined | null) => boolean;
  /** Clear to empty diagram template */
  clearDiagram: () => void;
}

const DrawioContext = createContext<DrawioContextType | undefined>(undefined);

const EMPTY_DIAGRAM = `<mxfile><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;

export function DrawioProvider({ children }: { children: React.ReactNode }) {
  const drawioRef = useRef<DrawIoEmbedRef | null>(null);
  const setDrawioData = useCanvasStore((s) => s.setDrawioData);
  const setHasUnsavedChanges = useCanvasStore((s) => s.setHasUnsavedChanges);

  const loadDiagram = useCallback(
    (chart: string, skipValidation?: boolean): string | null => {
      let xmlToLoad = chart;

      if (!skipValidation) {
        const validation = validateAndFixXml(chart);
        if (!validation.valid) {
          console.warn("[loadDiagram] Validation error:", validation.error);
          return validation.error;
        }
        if (validation.fixed) {
          xmlToLoad = validation.fixed;
        }
      }

      setDrawioData(xmlToLoad);
      setHasUnsavedChanges(true);

      if (drawioRef.current) {
        drawioRef.current.load({ xml: xmlToLoad });
      }

      return null;
    },
    [setDrawioData, setHasUnsavedChanges]
  );

  const clearDiagram = useCallback(() => {
    loadDiagram(EMPTY_DIAGRAM, true);
  }, [loadDiagram]);

  return (
    <DrawioContext.Provider
      value={{
        loadDiagram,
        drawioRef,
        isRealDiagram,
        clearDiagram,
      }}
    >
      {children}
    </DrawioContext.Provider>
  );
}

export function useDrawio() {
  const context = useContext(DrawioContext);
  if (context === undefined) {
    throw new Error("useDrawio must be used within a DrawioProvider");
  }
  return context;
}
