"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NodeToolbar, useReactFlow, Position } from "@xyflow/react";
import * as Popover from "@radix-ui/react-popover";
import {
  Bold,
  Italic,
  Strikethrough,
  Wand2,
  Copy,
  X,
  Type,
  Shapes,
  Smile,
  Plus,
  Minus,
  Rows3,
  Columns3,
  Pencil,
  LogOut,
  FileText,
  CheckSquare,
  Focus,
  Trash2,
  Replace,
  ChevronDown,
  GitBranchPlus,
  Tag,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Image,
} from "lucide-react";
import type { Node } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";
import { PALETTE_COLORS } from "@/lib/branch-colors";
import { SHAPE_TYPES, SHAPE_LABELS, type ShapeType } from "@/lib/shape-types";

/** Extended palette for shape fill (18 colors, circular swatches). */
const SHAPE_COLOR_PALETTE = [
  "#ffffff", "#fef3c7", "#d1fae5", "#dbeafe", "#fce7f3", "#e9d5ff",
  "#fef9c3", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fde68a",
  "#86efac", "#93c5fd", "#f9a8d4", "#c4b5fd", "#fcd34d", "#4ade80",
];
import { IconPickerPanel } from "@/components/panels/IconPickerPanel";
import { IconImageReplacerPanel } from "@/components/panels/IconImageReplacerPanel";
import type { FontSize, TextAlign, TextVerticalAlign } from "@/components/nodes/EditableNodeContent";
import type { ExtraHandle } from "@/components/nodes/BaseNode";

/** Node types that use the shape picker (rectangle, diamond, circle, document). */
const SHAPE_NODE_TYPES = ["rectangle", "diamond", "circle", "document"];

interface NodeInlineToolbarProps {
  nodeId: string;
  selected?: boolean;
}

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "S" },
  { value: "base", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
];

export function NodeInlineToolbar({ nodeId, selected = false }: NodeInlineToolbarProps) {
  const router = useRouter();
  const [colorOpen, setColorOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [shapeOpen, setShapeOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [handlesOpen, setHandlesOpen] = useState(false);
  const hoveredNodeId = useCanvasStore((s) => s.hoveredNodeId);
  const { getNode, getNodes, setNodes, deleteElements, updateNodeData } = useReactFlow();
  const node = getNode(nodeId);
  const pushUndo = useCanvasStore((s) => s.pushUndo);
  const isInGroup = Boolean(node?.parentId);
  const nodeType = node?.type ?? "";
  const isMindMap = nodeType === "mindMap";
  const isShapeNode = SHAPE_NODE_TYPES.includes(nodeType);
  const hasColorPicker = ["mindMap", "stickyNote", "text", "rectangle", "diamond", "circle", "document", "table"].includes(nodeType);
  const hasShapePicker = isShapeNode;
  const hasIconPicker = ["rectangle", "diamond", "circle", "document", "mindMap", "stickyNote", "text", "service", "queue", "actor", "databaseSchema", "group"].includes(nodeType);
  const hasIconImageReplacer = nodeType === "icon" || nodeType === "image";
  const isTableNode = nodeType === "table";
  // When 2+ nodes selected (e.g. Ctrl+A), hide toolbar for all — no toolbar even on hover. Single selection or none: show on hover or when this node is selected.
  const selectedCount = getNodes().filter((n) => n.selected).length;
  const toolbarVisible = selectedCount <= 1 && (hoveredNodeId === nodeId || (selected && selectedCount === 1));
  const currentShape = (node?.data?.shape as ShapeType) ?? "rectangle";
  const currentIcon = (node?.data?.icon as string) ?? null;
  const currentCustomIcon = (node?.data?.customIcon as string) ?? null;
  const currentIconId = (node?.data?.iconId as string) ?? null;
  const currentEmoji = (node?.data?.emoji as string) ?? null;
  const currentIconUrl = (node?.data?.iconUrl as string) ?? null;
  const currentImageUrl = (node?.data?.imageUrl as string) ?? (node?.data?.image as string) ?? null;

  const handleDuplicate = () => {
    const node = getNode(nodeId);
    if (!node) return;
    pushUndo();
    const newNode = {
      ...node,
      id: `node-${Date.now()}`,
      position: { x: node.position.x + 20, y: node.position.y + 20 },
      data: { ...node.data },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /** Get a node's position in flow coordinates (walk parent chain if it has parentId). */
  function getFlowPosition(n: Node, allNodes: Node[]): { x: number; y: number } {
    if (!n.parentId) return { ...n.position };
    const parent = allNodes.find((nd) => nd.id === n.parentId);
    if (!parent) return { ...n.position };
    const parentFlow = getFlowPosition(parent, allNodes);
    return {
      x: parentFlow.x + n.position.x,
      y: parentFlow.y + n.position.y,
    };
  }

  const handleExitGroup = () => {
    const n = getNode(nodeId);
    if (!n?.parentId) return;
    pushUndo();
    const nodes = getNodes();
    const flowPos = getFlowPosition(n, nodes);
    setNodes((nds) =>
      nds.map((nd) =>
        nd.id !== nodeId ? nd : { ...nd, parentId: undefined, extent: undefined, position: flowPos }
      )
    );
  };

  const handleDelete = () => {
    pushUndo();
    deleteElements({ nodes: [{ id: nodeId }] });
  };

  const handleAI = () => router.push("/ai-diagram");

  const setEditingNodeId = useCanvasStore((s) => s.setEditingNodeId);
  const handleEditText = () => setEditingNodeId(nodeId);

  const setDetailsPanelNodeId = useCanvasStore((s) => s.setDetailsPanelNodeId);
  const handleOpenDetails = () => setDetailsPanelNodeId(nodeId);

  const setFocusedBranchNodeId = useCanvasStore((s) => s.setFocusedBranchNodeId);
  const focusedBranchNodeId = useCanvasStore((s) => s.focusedBranchNodeId);
  const handleFocusMode = () => {
    setFocusedBranchNodeId(focusedBranchNodeId === nodeId ? null : nodeId);
  };

  // Task progress for this node
  const tasks = useCanvasStore((s) => s.nodeTasks[nodeId]);
  const taskCount = tasks?.length ?? 0;
  const taskDoneCount = tasks?.filter((t) => t.done).length ?? 0;
  const taskProgress = taskCount > 0 ? (taskDoneCount / taskCount) * 100 : 0;

  const handleColorChange = (color: string) => {
    if (hasColorPicker) {
      pushUndo();
      updateNodeData(nodeId, { color });
      setColorOpen(false);
    }
  };

  const fontWeight = (node?.data?.fontWeight as string) ?? "normal";
  const fontStyle = (node?.data?.fontStyle as string) ?? "normal";
  const textDecoration = (node?.data?.textDecoration as string) ?? "none";
  const fontSize = (node?.data?.fontSize as FontSize) ?? "sm";
  const textAlign = (node?.data?.textAlign as TextAlign) ?? "center";
  const textVerticalAlign = (node?.data?.textVerticalAlign as TextVerticalAlign) ?? "center";

  const handleBold = () => {
    pushUndo();
    updateNodeData(nodeId, { fontWeight: fontWeight === "bold" ? "normal" : "bold" });
  };
  const handleItalic = () => {
    pushUndo();
    updateNodeData(nodeId, { fontStyle: fontStyle === "italic" ? "normal" : "italic" });
  };
  const handleStrikethrough = () => {
    pushUndo();
    updateNodeData(nodeId, { textDecoration: textDecoration === "line-through" ? "none" : "line-through" });
  };
  const handleFontSize = (size: FontSize) => {
    pushUndo();
    updateNodeData(nodeId, { fontSize: size });
    setFontSizeOpen(false);
  };

  const handleTextAlign = (align: TextAlign) => {
    pushUndo();
    updateNodeData(nodeId, { textAlign: align });
  };
  const handleTextVerticalAlign = (align: TextVerticalAlign) => {
    pushUndo();
    updateNodeData(nodeId, { textVerticalAlign: align });
  };

  const handleShapeChange = (shape: ShapeType) => {
    if (hasShapePicker) {
      pushUndo();
      updateNodeData(nodeId, { shape });
      setShapeOpen(false);
    }
  };

  const handleIconChange = (iconId: string | null) => {
    if (hasIconPicker) {
      pushUndo();
      updateNodeData(nodeId, {
        icon: iconId ?? undefined,
        customIcon: undefined,
        iconUrl: undefined,
      });
    }
  };

  const handleCustomIconChange = (dataUrl: string | null) => {
    if (hasIconPicker) {
      pushUndo();
      updateNodeData(nodeId, {
        customIcon: dataUrl ?? undefined,
        icon: undefined,
        iconUrl: undefined,
      });
    }
  };

  // Icon/Image node replacer handlers
  const handleIconNodeIconIdChange = (id: string | null) => {
    if (nodeType === "icon") {
      pushUndo();
      const cleared = {
        iconId: id ?? undefined,
        emoji: undefined,
        customIcon: undefined,
        iconUrl: undefined,
      };
      updateNodeData(nodeId, cleared);
    }
  };
  const handleIconNodeEmojiChange = (emojiVal: string | null) => {
    if (nodeType === "icon") {
      pushUndo();
      updateNodeData(nodeId, {
        emoji: emojiVal ?? undefined,
        iconId: undefined,
        customIcon: undefined,
        iconUrl: undefined,
      });
    }
  };
  const handleIconNodeCustomIconChange = (dataUrl: string | null) => {
    if (nodeType === "icon") {
      pushUndo();
      updateNodeData(nodeId, {
        customIcon: dataUrl ?? undefined,
        iconId: undefined,
        emoji: undefined,
        iconUrl: undefined,
      });
    }
  };
  const handleIconNodeIconUrlChange = (url: string | null) => {
    if (nodeType === "icon") {
      pushUndo();
      updateNodeData(nodeId, {
        iconUrl: url ?? undefined,
        iconId: undefined,
        emoji: undefined,
        customIcon: undefined,
      });
    }
  };
  const handleImageNodeUrlChange = (url: string | null) => {
    if (nodeType === "image") {
      pushUndo();
      updateNodeData(nodeId, { imageUrl: url ?? undefined, image: url ?? undefined });
    }
  };
  const handleImageNodeUpload = (dataUrl: string) => {
    if (nodeType === "image") {
      pushUndo();
      updateNodeData(nodeId, { imageUrl: dataUrl, image: dataUrl });
    }
  };

  const tableRows = (node?.data?.tableRows as number) ?? 3;
  const tableCols = (node?.data?.tableCols as number) ?? 3;
  const tableCells = (node?.data?.cells as Record<string, string>) ?? {};
  const handleTableAddRow = () => { pushUndo(); updateNodeData(nodeId, { tableRows: tableRows + 1 }); };
  const handleTableAddColumn = () => { pushUndo(); updateNodeData(nodeId, { tableCols: tableCols + 1 }); };
  const handleTableDeleteRow = () => {
    if (tableRows <= 1) return;
    pushUndo();
    const nextCells = { ...tableCells };
    for (let c = 0; c < tableCols; c++) delete nextCells[`${tableRows - 1},${c}`];
    updateNodeData(nodeId, { tableRows: tableRows - 1, cells: nextCells });
  };
  const handleTableDeleteColumn = () => {
    if (tableCols <= 1) return;
    pushUndo();
    const nextCells = { ...tableCells };
    for (let r = 0; r < tableRows; r++) delete nextCells[`${r},${tableCols - 1}`];
    updateNodeData(nodeId, { tableCols: tableCols - 1, cells: nextCells });
  };

  /** Node types that can be converted to */
  const CONVERTIBLE_TYPES: { type: string; label: string }[] = [
    { type: "rectangle", label: "Rectangle" },
    { type: "diamond", label: "Diamond" },
    { type: "circle", label: "Circle" },
    { type: "document", label: "Document" },
    { type: "stickyNote", label: "Sticky Note" },
    { type: "text", label: "Text" },
    { type: "mindMap", label: "Mind Map" },
    { type: "icon", label: "Icon" },
    { type: "image", label: "Image" },
  ];

  /** Whether this node type can be replaced */
  const canReplace = ["rectangle", "diamond", "circle", "document", "stickyNote", "text", "mindMap", "icon", "image"].includes(nodeType);

  const handleReplaceType = (newType: string) => {
    if (!node || newType === nodeType) return;
    pushUndo();
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, type: newType, data: { ...n.data } }
          : n
      )
    );
    setReplaceOpen(false);
  };

  // ── Handle management ──
  const extraHandles: ExtraHandle[] = (node?.data?.extraHandles as ExtraHandle[] | undefined) ?? [];
  const HANDLE_SIDES: ExtraHandle["position"][] = ["top", "right", "bottom", "left"];

  /** Count of extra handles on a given side */
  const handleCountPerSide = (side: ExtraHandle["position"]) =>
    extraHandles.filter((h) => h.position === side).length;

  /** Add a handle on a specific side. Offset is auto-distributed evenly. */
  const handleAddHandle = (side: ExtraHandle["position"]) => {
    pushUndo();
    const existing = extraHandles.filter((h) => h.position === side);
    const count = existing.length + 1;
    // Re-distribute offsets evenly across the side (including the new one)
    const redistributed: ExtraHandle[] = [];
    for (let i = 0; i < count; i++) {
      const offset = Math.round(((i + 1) / (count + 1)) * 100);
      redistributed.push({
        id: existing[i]?.id ?? `extra-${side}-${Date.now()}-${i}`,
        position: side,
        offset,
      });
    }
    // Keep handles from other sides + redistributed handles for this side
    const otherHandles = extraHandles.filter((h) => h.position !== side);
    updateNodeData(nodeId, { extraHandles: [...otherHandles, ...redistributed] });
  };

  /** Remove the last handle on a specific side. */
  const handleRemoveHandle = (side: ExtraHandle["position"]) => {
    pushUndo();
    const existing = extraHandles.filter((h) => h.position === side);
    if (existing.length === 0) return;
    // Remove the last one, re-distribute remaining
    const remaining = existing.slice(0, -1);
    const count = remaining.length;
    const redistributed = remaining.map((h, i) => ({
      ...h,
      offset: Math.round(((i + 1) / (count + 1)) * 100),
    }));
    const otherHandles = extraHandles.filter((h) => h.position !== side);
    updateNodeData(nodeId, { extraHandles: [...otherHandles, ...redistributed] });
  };

  /** Whether this node type supports handles management */
  const hasHandleManagement = ![
    "freeDraw", "edgeAnchor", "group",
  ].includes(nodeType);

  return (
    <NodeToolbar position={Position.Top} offset={8} align="center" isVisible={toolbarVisible}>
      <div className="flex flex-wrap items-center gap-0.5 bg-gray-800 text-gray-200 rounded-lg px-1 py-1 shadow-lg border border-gray-700">
        {isTableNode && (
          <>
            <ToolbarButton title="Add row" onClick={handleTableAddRow}>
              <Plus className="w-3.5 h-3.5" />
              <Rows3 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Add column" onClick={handleTableAddColumn}>
              <Plus className="w-3.5 h-3.5" />
              <Columns3 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Delete last row" onClick={handleTableDeleteRow} disabled={tableRows <= 1}>
              <Minus className="w-3.5 h-3.5" />
              <Rows3 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Delete last column" onClick={handleTableDeleteColumn} disabled={tableCols <= 1}>
              <Minus className="w-3.5 h-3.5" />
              <Columns3 className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarDivider />
          </>
        )}
        {hasShapePicker && (
          <Popover.Root open={shapeOpen} onOpenChange={setShapeOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                title="Change shape"
                className="p-1.5 rounded hover:bg-gray-600 transition-colors flex items-center gap-0.5"
                aria-label="Change shape"
              >
                <Shapes className="w-3.5 h-3.5" />
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 w-56 p-2 rounded-lg bg-gray-800 border border-gray-600 shadow-lg"
                sideOffset={4}
                align="start"
              >
                <div className="text-xs text-gray-400 mb-2">Shape</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SHAPE_TYPES.map((shape) => (
                    <button
                      key={shape}
                      type="button"
                      onClick={() => handleShapeChange(shape)}
                      className={`px-2 py-1.5 text-left text-xs rounded transition-colors ${
                        currentShape === shape ? "bg-violet-600 text-white" : "hover:bg-gray-700 text-gray-200"
                      }`}
                      title={SHAPE_LABELS[shape]}
                    >
                      {SHAPE_LABELS[shape]}
                    </button>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
        <ToolbarDivider />
        <ToolbarButton title="Bold" onClick={handleBold} active={fontWeight === "bold"}>
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={handleItalic} active={fontStyle === "italic"}>
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Strikethrough" onClick={handleStrikethrough} active={textDecoration === "line-through"}>
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarButton>
        {hasColorPicker && (
          <>
            <ToolbarDivider />
            <ToolbarButton title="Align left" onClick={() => handleTextAlign("left")} active={textAlign === "left"}>
              <AlignLeft className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Align center" onClick={() => handleTextAlign("center")} active={textAlign === "center"}>
              <AlignCenter className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Align right" onClick={() => handleTextAlign("right")} active={textAlign === "right"}>
              <AlignRight className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Align top" onClick={() => handleTextVerticalAlign("top")} active={textVerticalAlign === "top"}>
              <AlignVerticalJustifyStart className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Align middle" onClick={() => handleTextVerticalAlign("center")} active={textVerticalAlign === "center"}>
              <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Align bottom" onClick={() => handleTextVerticalAlign("bottom")} active={textVerticalAlign === "bottom"}>
              <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />
            </ToolbarButton>
          </>
        )}
        <ToolbarDivider />
        {hasIconPicker && (
          <IconPickerPanel
            value={currentIcon}
            onChange={handleIconChange}
            customIcon={currentCustomIcon}
            onCustomIconChange={handleCustomIconChange}
            trigger={
              <button
                type="button"
                title="Add icon"
                className="p-1.5 rounded hover:bg-gray-600 transition-colors flex items-center gap-0.5"
                aria-label="Add icon"
              >
                <Smile className="w-3.5 h-3.5" />
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
            }
          />
        )}
        {hasIconImageReplacer && (
          <>
            <ToolbarDivider />
            <IconImageReplacerPanel
              mode={nodeType as "icon" | "image"}
              trigger={
                <button
                  type="button"
                  title={nodeType === "icon" ? "Replace icon" : "Replace image"}
                  className="p-1.5 rounded hover:bg-gray-600 transition-colors flex items-center gap-0.5"
                  aria-label={nodeType === "icon" ? "Replace icon" : "Replace image"}
                >
                  <Image className="w-3.5 h-3.5" />
                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                </button>
              }
              iconId={currentIconId}
              emoji={currentEmoji}
              customIcon={nodeType === "icon" ? currentCustomIcon : null}
              iconUrl={currentIconUrl}
              onIconIdChange={handleIconNodeIconIdChange}
              onEmojiChange={handleIconNodeEmojiChange}
              onCustomIconChange={handleIconNodeCustomIconChange}
              onIconUrlChange={handleIconNodeIconUrlChange}
              imageUrl={currentImageUrl}
              onImageUrlChange={handleImageNodeUrlChange}
              onImageUpload={handleImageNodeUpload}
            />
          </>
        )}
        {hasColorPicker && (
          <Popover.Root open={colorOpen} onOpenChange={setColorOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                title="Fill color"
                className={cn(
                  "p-1.5 rounded transition-colors flex items-center gap-0.5",
                  colorOpen ? "bg-white text-gray-800 ring-2 ring-violet-400" : "hover:bg-gray-600"
                )}
                aria-label="Fill color"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-gray-500 bg-white" aria-hidden />
                <ChevronDown className={cn("w-2.5 h-2.5 opacity-60", colorOpen && "text-gray-600")} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 w-52 p-3 rounded-xl bg-gray-800 border border-gray-600 shadow-xl"
                sideOffset={8}
                align="start"
              >
                <div className="text-xs font-medium text-gray-400 mb-2.5">Fill color</div>
                <div className="grid grid-cols-6 gap-2">
                  {(isShapeNode ? SHAPE_COLOR_PALETTE : PALETTE_COLORS).map((color) => {
                    const isSelected = (node?.data?.color as string) === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleColorChange(color)}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 transition-all hover:scale-110",
                          isSelected ? "border-violet-400 ring-2 ring-violet-400/50 ring-offset-2 ring-offset-gray-800" : "border-gray-600 hover:border-gray-500"
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    );
                  })}
                </div>
                {isMindMap && (
                  <button
                    type="button"
                    onClick={() => handleColorChange("")}
                    className="mt-3 w-full text-xs text-gray-400 hover:text-white py-1.5 rounded"
                  >
                    Reset to branch
                  </button>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
        <Popover.Root open={fontSizeOpen} onOpenChange={setFontSizeOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              title="Font size"
              className="p-1.5 rounded hover:bg-gray-600 transition-colors flex items-center gap-0.5"
              aria-label="Font size"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="text-[10px] opacity-80">{FONT_SIZES.find((f) => f.value === fontSize)?.label ?? "S"}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="z-50 w-28 p-2 rounded-lg bg-gray-800 border border-gray-600 shadow-lg"
              sideOffset={4}
              align="start"
            >
              <div className="text-xs text-gray-400 mb-2">Font size</div>
              <div className="flex flex-col gap-0.5">
                {FONT_SIZES.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => handleFontSize(f.value)}
                    className={`px-2 py-1.5 text-left text-sm rounded hover:bg-gray-700 ${fontSize === f.value ? "bg-gray-700" : ""}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <ToolbarDivider />
        <ToolbarButton title="Edit text" onClick={handleEditText}>
          <Pencil className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Notes (Shift+E)" onClick={handleOpenDetails}>
          <FileText className="w-3.5 h-3.5" />
        </ToolbarButton>
        {taskCount > 0 && (
          <ToolbarButton title={`Tasks: ${taskDoneCount}/${taskCount}`} onClick={handleOpenDetails}>
            <CheckSquare className="w-3.5 h-3.5" />
            <span className="text-[9px] ml-0.5 opacity-80">{Math.round(taskProgress)}%</span>
          </ToolbarButton>
        )}
        <ToolbarButton title="AI" onClick={handleAI}>
          <Wand2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Duplicate" onClick={handleDuplicate}>
          <Copy className="w-3.5 h-3.5" />
        </ToolbarButton>
        {canReplace && (
          <Popover.Root open={replaceOpen} onOpenChange={setReplaceOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                title="Change node type"
                className="p-1.5 rounded hover:bg-gray-600 transition-colors flex items-center gap-0.5"
                aria-label="Change node type"
              >
                <Replace className="w-3.5 h-3.5" />
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 w-40 p-1.5 rounded-lg bg-gray-800 border border-gray-600 shadow-lg"
                sideOffset={4}
                align="start"
              >
                <div className="text-[10px] text-gray-400 uppercase tracking-wider px-2 mb-1">Change to</div>
                <div className="flex flex-col gap-0.5">
                  {CONVERTIBLE_TYPES.map((ct) => (
                    <button
                      key={ct.type}
                      type="button"
                      onClick={() => handleReplaceType(ct.type)}
                      className={cn(
                        "px-2 py-1.5 text-left text-xs rounded transition-colors",
                        ct.type === nodeType
                          ? "bg-violet-600 text-white"
                          : "hover:bg-gray-700 text-gray-200"
                      )}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
        {hasHandleManagement && (
          <Popover.Root open={handlesOpen} onOpenChange={setHandlesOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                title="Manage handles"
                className="p-1.5 rounded hover:bg-gray-600 transition-colors flex items-center gap-0.5"
                aria-label="Manage handles"
              >
                <GitBranchPlus className="w-3.5 h-3.5" />
                {extraHandles.length > 0 && (
                  <span className="text-[9px] text-violet-300 font-bold">{extraHandles.length}</span>
                )}
                <ChevronDown className="w-2.5 h-2.5 opacity-60" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 w-52 p-2.5 rounded-lg bg-gray-800 border border-gray-600 shadow-lg"
                sideOffset={4}
                align="start"
              >
                <div className="text-xs font-medium text-gray-400 mb-2">Extra Handles</div>
                <div className="flex flex-col gap-1.5">
                  {HANDLE_SIDES.map((side) => {
                    const count = handleCountPerSide(side);
                    return (
                      <div key={side} className="flex items-center justify-between px-1">
                        <span className="text-xs text-gray-300 capitalize w-14">{side}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveHandle(side)}
                            disabled={count === 0}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-600 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={`Remove handle from ${side}`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-mono text-gray-200 w-4 text-center">{count}</span>
                          <button
                            type="button"
                            onClick={() => handleAddHandle(side)}
                            disabled={count >= 5}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-600 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title={`Add handle to ${side}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {extraHandles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      pushUndo();
                      updateNodeData(nodeId, { extraHandles: [] });
                    }}
                    className="mt-2 w-full text-xs text-gray-400 hover:text-white py-1.5 rounded hover:bg-gray-700 transition-colors"
                  >
                    Remove all handles
                  </button>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        )}
        <ToolbarButton
          title={node?.data?.annotation ? "Edit label" : "Add label"}
          onClick={() => {
            if (!node?.data?.annotation) {
              pushUndo();
              updateNodeData(nodeId, { annotation: "Label" });
            }
          }}
          active={!!node?.data?.annotation}
        >
          <Tag className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Focus mode" onClick={handleFocusMode} active={focusedBranchNodeId === nodeId}>
          <Focus className="w-3.5 h-3.5" />
        </ToolbarButton>
        {isInGroup && (
          <ToolbarButton title="Exit group" onClick={handleExitGroup}>
            <LogOut className="w-3.5 h-3.5" />
          </ToolbarButton>
        )}
        <ToolbarDivider />
        <ToolbarButton title="Delete node" onClick={handleDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>
    </NodeToolbar>
  );
}

function ToolbarButton({
  title,
  children,
  onClick,
  active,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors ${active ? "bg-violet-600 text-white" : "hover:bg-gray-600"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-gray-600 mx-0.5" />;
}
