"use client";

import { useCallback, useRef, useState } from "react";
import { Panel, useStore, useReactFlow } from "@xyflow/react";
import * as Popover from "@radix-ui/react-popover";
import { PALETTE_COLORS, getNodeBranchStyle } from "@/lib/branch-colors";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCanvasStore } from "@/lib/store/canvas-store";

const COLOR_NODE_TYPES = ["mindMap", "stickyNote", "text", "rectangle", "diamond", "circle", "document"];

export function MobileColorIndicator() {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const nodes = useStore((s) => s.nodes);
  const { updateNodeData, getEdges } = useReactFlow();
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const selectedNode = nodes.find((n) => n.selected && COLOR_NODE_TYPES.includes(n.type ?? ""));
  const [pos, setPos] = useState({ x: 16, y: 80 });
  const [colorOpen, setColorOpen] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const TAP_THRESHOLD = 6;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!selectedNode) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: pos.x,
        startPosY: pos.y,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [selectedNode, pos]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos({
        x: Math.max(0, dragRef.current.startPosX + dx),
        y: Math.max(0, dragRef.current.startPosY + dy),
      });
    },
    []
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const el = e.target as HTMLElement;
      el.releasePointerCapture?.(e.pointerId);
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const moved = Math.sqrt(dx * dx + dy * dy) > TAP_THRESHOLD;
        if (!moved) setColorOpen((o) => !o);
      }
      dragRef.current = null;
    },
    []
  );

  const handleColorChange = useCallback(
    (color: string) => {
      if (!selectedNode) return;
      pushUndo();
      updateNodeData(selectedNode.id, { color });
      setColorOpen(false);
    },
    [selectedNode, updateNodeData, pushUndo]
  );

  const edges = getEdges();
  const overrideColor = selectedNode?.data?.color as string | undefined;
  const branchStyle = selectedNode
    ? getNodeBranchStyle(selectedNode.id, edges, overrideColor || undefined)
    : null;
  const color = overrideColor?.trim() ? overrideColor : (branchStyle?.bg ?? PALETTE_COLORS[0]);
  const isMindMap = selectedNode?.type === "mindMap";

  if (!isMobile || !selectedNode) return null;

  return (
    <Panel position="top-left" className="!m-0 !p-0 !inset-0 !right-auto !bottom-auto !pointer-events-none">
      <div
        className="fixed touch-none select-none z-50 pointer-events-auto"
        style={{ left: pos.x, top: pos.y }}
      >
        <Popover.Root open={colorOpen} onOpenChange={setColorOpen}>
          <Popover.Trigger asChild>
            <div
              role="button"
              tabIndex={0}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onKeyDown={(e) => e.key === "Enter" && setColorOpen((o) => !o)}
              className="w-12 h-12 rounded-full shadow-lg border-2 border-white cursor-grab active:cursor-grabbing flex items-center justify-center ring-2 ring-gray-300/50"
              style={{ backgroundColor: color }}
              aria-label="Color indicator - drag to move, tap to change color"
              title="Drag to move • Tap to change color"
            />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-[100] w-40 p-3 rounded-xl bg-white border border-gray-200 shadow-xl"
              sideOffset={8}
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="text-xs text-gray-500 mb-2 font-medium">
                Background color
              </div>
              <div className="grid grid-cols-5 gap-2">
                {PALETTE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColorChange(c)}
                    className="w-8 h-8 rounded-lg border-2 transition-colors hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: c === color ? "rgb(139 92 246)" : "transparent",
                    }}
                    title={c}
                  />
                ))}
              </div>
              {isMindMap && (
                <button
                  type="button"
                  onClick={() => handleColorChange("")}
                  className="mt-2 w-full text-xs text-gray-500 hover:text-violet-600 py-2"
                >
                  Reset to branch
                </button>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </Panel>
  );
}
