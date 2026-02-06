"use client";

import { useCallback, useEffect } from "react";
import { useCopyPaste } from "@/hooks/useCopyPaste";
import type { Node, Edge } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";

interface KeyboardHandlerProps {
  getNodes: () => Node[];
  getEdges: () => Edge[];
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  pushUndo?: () => void;
  undo?: () => void;
  redo?: () => void;
}

export function KeyboardHandler({
  getNodes,
  getEdges,
  setNodes,
  setEdges,
  screenToFlowPosition,
  pushUndo,
  undo,
  redo,
}: KeyboardHandlerProps) {
  const { copy, paste, deleteSelected } = useCopyPaste(
    getNodes,
    getEdges,
    setNodes,
    setEdges,
    screenToFlowPosition
  );

  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const setSearchOpen = useCanvasStore((s) => s.setSearchOpen);
  const setShortcutsOpen = useCanvasStore((s) => s.setShortcutsOpen);
  const setDetailsPanelNodeId = useCanvasStore((s) => s.setDetailsPanelNodeId);
  const setDailyNotesOpen = useCanvasStore((s) => s.setDailyNotesOpen);
  const setPresentationMode = useCanvasStore((s) => s.setPresentationMode);
  const setFocusedBranchNodeId = useCanvasStore((s) => s.setFocusedBranchNodeId);

  const selectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: true })));
  }, [setNodes, setEdges]);

  const deselectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
  }, [setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const inInput =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable;
      const isUndoRedo = (e.metaKey || e.ctrlKey) && !inInput;

      // ─── Panels that work everywhere (close with Esc) ──────────
      const {
        shortcutsOpen,
        searchOpen,
        settingsOpen,
        detailsPanelNodeId,
        dailyNotesOpen,
        presentationMode,
      } = useCanvasStore.getState();

      // When presentation mode is active, skip all normal shortcuts
      // (PresentationMode handles its own keys via capture phase)
      if (presentationMode) return;

      // Escape: close any open panel
      if (e.key === "Escape") {
        if (shortcutsOpen) { setShortcutsOpen(false); e.preventDefault(); return; }
        if (searchOpen) { setSearchOpen(false); e.preventDefault(); return; }
        if (settingsOpen) { useCanvasStore.getState().setSettingsOpen(false); e.preventDefault(); return; }
        if (detailsPanelNodeId) { setDetailsPanelNodeId(null); e.preventDefault(); return; }
        if (dailyNotesOpen) { setDailyNotesOpen(false); e.preventDefault(); return; }
        if (!inInput) deselectAll();
        return;
      }

      // Ctrl+F / Cmd+F: Search
      if ((e.key === "f" || e.key === "F") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Ctrl+Shift+D: Daily notes
      if ((e.key === "d" || e.key === "D") && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setDailyNotesOpen(!dailyNotesOpen);
        return;
      }

      // Shift+?: Keyboard shortcuts
      if (e.key === "?" && e.shiftKey && !inInput) {
        e.preventDefault();
        setShortcutsOpen(!shortcutsOpen);
        return;
      }

      // Shift+E: Open notes panel for selected node
      if (e.key === "E" && e.shiftKey && !inInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const selectedNode = getNodes().find((n) => n.selected);
        if (selectedNode) {
          setDetailsPanelNodeId(
            detailsPanelNodeId === selectedNode.id ? null : selectedNode.id
          );
        }
        return;
      }

      // Shift+T: Open tasks panel for selected node
      if (e.key === "T" && e.shiftKey && !inInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const selectedNode = getNodes().find((n) => n.selected);
        if (selectedNode) {
          setDetailsPanelNodeId(selectedNode.id);
        }
        return;
      }

      // P: Presentation mode (when not in input)
      if ((e.key === "p" || e.key === "P") && !inInput && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setPresentationMode(true);
        return;
      }

      // F: Focus mode on selected node (when not in input)
      if ((e.key === "f" || e.key === "F") && !inInput && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        const selectedNode = getNodes().find((n) => n.selected);
        const { focusedBranchNodeId } = useCanvasStore.getState();
        if (focusedBranchNodeId) {
          setFocusedBranchNodeId(null);
        } else if (selectedNode) {
          setFocusedBranchNodeId(selectedNode.id);
        }
        return;
      }

      // Tool switching (only when not in input and no modifier keys)
      if (!inInput && !e.metaKey && !e.ctrlKey) {
        if (e.key === "v" || e.key === "V") {
          // V = Select tool (like Figma)
          e.preventDefault();
          setActiveTool("select");
          return;
        }
        if (e.key === "m" || e.key === "M") {
          // M = Move nodes tool
          e.preventDefault();
          setActiveTool("move");
          return;
        }
        if (e.key === "h" || e.key === "H") {
          // H = Pan tool (hand)
          e.preventDefault();
          setActiveTool("pan");
          return;
        }
      }

      // Ctrl/Cmd+Shift+G: Ungroup selected group
      if ((e.key === "g" || e.key === "G") && (e.metaKey || e.ctrlKey) && e.shiftKey && !inInput) {
        e.preventDefault();
        const selectedGroups = getNodes().filter((n) => n.selected && n.type === "group");
        if (selectedGroups.length === 0) return;
        pushUndo?.();
        const groupIds = new Set(selectedGroups.map((g) => g.id));
        setNodes((nds) => {
          // Move children back to absolute position and remove parentId
          return nds
            .map((n) => {
              if (n.parentId && groupIds.has(n.parentId)) {
                const parentGroup = nds.find((g) => g.id === n.parentId);
                return {
                  ...n,
                  parentId: undefined,
                  extent: undefined,
                  position: parentGroup
                    ? { x: n.position.x + parentGroup.position.x, y: n.position.y + parentGroup.position.y }
                    : n.position,
                };
              }
              return n;
            })
            .filter((n) => !groupIds.has(n.id)); // remove the group nodes
        });
        return;
      }

      // Ctrl/Cmd+G: Group selected nodes into a group/subflow
      if ((e.key === "g" || e.key === "G") && (e.metaKey || e.ctrlKey) && !inInput) {
        e.preventDefault();
        const selectedNodes = getNodes().filter((n) => n.selected && n.type !== "group");
        if (selectedNodes.length < 2) return;

        pushUndo?.();

        // Calculate bounding box of selected nodes
        const PADDING = 40;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of selectedNodes) {
          const w = (n.measured?.width ?? (n.width as number | undefined)) || 140;
          const h = (n.measured?.height ?? (n.height as number | undefined)) || 72;
          minX = Math.min(minX, n.position.x);
          minY = Math.min(minY, n.position.y);
          maxX = Math.max(maxX, n.position.x + w);
          maxY = Math.max(maxY, n.position.y + h);
        }

        const groupId = `group-${Date.now()}`;
        const groupX = minX - PADDING;
        const groupY = minY - PADDING - 28; // extra space for group header
        const groupW = maxX - minX + PADDING * 2;
        const groupH = maxY - minY + PADDING * 2 + 28;

        const groupNode: Node = {
          id: groupId,
          type: "group",
          position: { x: groupX, y: groupY },
          data: { label: "Group" },
          style: { width: groupW, height: groupH },
          width: groupW,
          height: groupH,
        };

        setNodes((nds) => {
          // Add group node, then update selected nodes to be children
          const newNodes = [groupNode, ...nds.map((n) => {
            if (n.selected && n.type !== "group") {
              return {
                ...n,
                parentId: groupId,
                extent: "parent" as const,
                position: {
                  x: n.position.x - groupX,
                  y: n.position.y - groupY,
                },
                selected: false,
              };
            }
            return n;
          })];
          return newNodes;
        });
        return;
      }

      if (e.key === "a" && (e.metaKey || e.ctrlKey) && !inInput) {
        e.preventDefault();
        if (e.shiftKey) {
          deselectAll();
        } else {
          selectAll();
        }
      } else if (e.key === "c" && (e.metaKey || e.ctrlKey) && !inInput) {
        e.preventDefault();
        copy();
      } else if (e.key === "v" && (e.metaKey || e.ctrlKey) && !inInput) {
        e.preventDefault();
        paste();
      } else if (e.key === "x" && (e.metaKey || e.ctrlKey) && !inInput) {
        e.preventDefault();
        copy();
        pushUndo?.();
        deleteSelected();
      } else if (isUndoRedo && (e.key === "z" || e.key === "Z" || e.keyCode === 90)) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          redo?.();
        } else {
          undo?.();
        }
      } else if (isUndoRedo && (e.key === "y" || e.key === "Y" || e.keyCode === 89)) {
        e.preventDefault();
        e.stopPropagation();
        redo?.();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        if (!inInput) {
          e.preventDefault();
          pushUndo?.();
          deleteSelected();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [copy, paste, deleteSelected, pushUndo, undo, redo, selectAll, deselectAll, setSearchOpen, setShortcutsOpen, setDetailsPanelNodeId, setDailyNotesOpen, setPresentationMode, setFocusedBranchNodeId, getNodes, setActiveTool]);

  return null;
}
