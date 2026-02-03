"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NodeToolbar, useReactFlow, Position } from "@xyflow/react";
import * as Popover from "@radix-ui/react-popover";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Link,
  AtSign,
  Scissors,
  User,
  GitBranch,
  LayoutGrid,
  Wand2,
  Copy,
  MessageSquare,
  MoreHorizontal,
  X,
  Filter,
  PenTool,
  Palette,
  EyeOff,
  Minus,
  Type,
} from "lucide-react";
import { PALETTE_COLORS } from "@/lib/branch-colors";
import type { FontSize } from "@/components/nodes/EditableNodeContent";

interface NodeInlineToolbarProps {
  nodeId: string;
}

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "S" },
  { value: "base", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
];

export function NodeInlineToolbar({ nodeId }: NodeInlineToolbarProps) {
  const router = useRouter();
  const [colorOpen, setColorOpen] = useState(false);
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const { getNode, setNodes, deleteElements, updateNodeData } = useReactFlow();
  const node = getNode(nodeId);
  const isMindMap = node?.type === "mindMap";
  const hasColorPicker = ["mindMap", "stickyNote", "text", "rectangle", "diamond", "circle", "document"].includes(node?.type ?? "");

  const handleDuplicate = () => {
    const node = getNode(nodeId);
    if (!node) return;
    const newNode = {
      ...node,
      id: `node-${Date.now()}`,
      position: { x: node.position.x + 20, y: node.position.y + 20 },
      data: { ...node.data },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleDelete = () => {
    deleteElements({ nodes: [{ id: nodeId }] });
  };

  const handleAI = () => router.push("/ai-diagram");

  const handleColorChange = (color: string) => {
    if (hasColorPicker) {
      updateNodeData(nodeId, { color });
      setColorOpen(false);
    }
  };

  const fontWeight = (node?.data?.fontWeight as string) ?? "normal";
  const fontStyle = (node?.data?.fontStyle as string) ?? "normal";
  const textDecoration = (node?.data?.textDecoration as string) ?? "none";
  const fontSize = (node?.data?.fontSize as FontSize) ?? "sm";

  const handleBold = () => {
    updateNodeData(nodeId, { fontWeight: fontWeight === "bold" ? "normal" : "bold" });
  };
  const handleItalic = () => {
    updateNodeData(nodeId, { fontStyle: fontStyle === "italic" ? "normal" : "italic" });
  };
  const handleStrikethrough = () => {
    updateNodeData(nodeId, { textDecoration: textDecoration === "line-through" ? "none" : "line-through" });
  };
  const handleFontSize = (size: FontSize) => {
    updateNodeData(nodeId, { fontSize: size });
    setFontSizeOpen(false);
  };

  return (
    <NodeToolbar position={Position.Top} offset={8} align="center">
      <div className="flex items-center gap-0.5 bg-gray-800 text-gray-200 rounded-lg px-1 py-1 shadow-lg border border-gray-700">
        <ToolbarButton title="Filter/Sort">
          <Filter className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton
          title="Bold"
          onClick={handleBold}
          active={fontWeight === "bold"}
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          onClick={handleItalic}
          active={fontStyle === "italic"}
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          onClick={handleStrikethrough}
          active={textDecoration === "line-through"}
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton title="Bullet list">
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Numbered list">
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Link">
          <Link className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Mention">
          <AtSign className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton title="Cut/Split">
          <Scissors className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Assign">
          <User className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Line style">
          <GitBranch className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Stroke style">
          <Minus className="w-3.5 h-3.5" />
        </ToolbarButton>
        {hasColorPicker ? (
          <Popover.Root open={colorOpen} onOpenChange={setColorOpen}>
            <Popover.Trigger asChild>
              <button
                type="button"
                title="Background color"
                className="p-1.5 rounded hover:bg-gray-600 transition-colors"
                aria-label="Background color"
              >
                <Palette className="w-3.5 h-3.5" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-50 w-40 p-2 rounded-lg bg-gray-800 border border-gray-600 shadow-lg"
                sideOffset={4}
                align="start"
              >
                <div className="text-xs text-gray-400 mb-2">Background color</div>
                <div className="grid grid-cols-5 gap-1.5">
                  {PALETTE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorChange(color)}
                      className="w-6 h-6 rounded-md border-2 border-gray-600 hover:border-gray-400 transition-colors"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                {isMindMap && (
                  <button
                    type="button"
                    onClick={() => handleColorChange("")}
                    className="mt-2 w-full text-xs text-gray-400 hover:text-white py-1"
                  >
                    Reset to branch
                  </button>
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : (
          <ToolbarButton title="Color">
            <Palette className="w-3.5 h-3.5" />
          </ToolbarButton>
        )}
        <Popover.Root open={fontSizeOpen} onOpenChange={setFontSizeOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              title="Font size"
              className="p-1.5 rounded hover:bg-gray-600 transition-colors flex items-center gap-1"
              aria-label="Font size"
            >
              <Type className="w-3.5 h-3.5" />
              <span className="text-[10px] opacity-80">{FONT_SIZES.find((f) => f.value === fontSize)?.label ?? "S"}</span>
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
        <ToolbarButton title="Layout">
          <LayoutGrid className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Draw">
          <PenTool className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Hide">
          <EyeOff className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="AI" onClick={handleAI}>
          <Wand2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Duplicate" onClick={handleDuplicate}>
          <Copy className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Comment">
          <MessageSquare className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton title="More">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Close" onClick={handleDelete}>
          <X className="w-3.5 h-3.5" />
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
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${active ? "bg-violet-600 text-white" : "hover:bg-gray-600"}`}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-4 bg-gray-600 mx-0.5" />;
}
