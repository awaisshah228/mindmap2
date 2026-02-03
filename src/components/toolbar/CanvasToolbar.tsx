"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  StickyNote,
  Type,
  GitBranch,
  Wand2,
  Frame,
  List,
  Link,
  Image,
  Brain,
  Pencil,
  Shapes,
  MousePointer2,
  Hand,
  Smile,
  Eraser,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SHAPE_TYPES, SHAPE_LABELS, SHAPE_PATHS, type ShapeType } from "@/lib/shape-types";
import { ICON_REGISTRY } from "@/lib/icon-registry";
import { useCanvasStore } from "@/lib/store/canvas-store";
import type { Tool } from "@/lib/store/canvas-store";
import type { PendingEdgeType } from "@/lib/store/canvas-store";

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  tool: Tool;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, tool, active, onClick }: ToolButtonProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
            active ? "bg-violet-100 text-violet-600" : "hover:bg-gray-100 text-gray-600"
          )}
          aria-label={label}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

interface CanvasToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
}

const EDGE_TYPE_OPTIONS: { type: PendingEdgeType; label: string; icon: React.ReactNode }[] = [
  {
    type: "default",
    label: "Bezier (curved)",
    icon: (
      <svg width="20" height="14" viewBox="0 0 16 12" fill="none">
        <path d="M1 1 Q8 11 15 11" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
  {
    type: "straight",
    label: "Straight",
    icon: (
      <svg width="20" height="14" viewBox="0 0 16 12" fill="none">
        <path d="M1 6 L15 6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    type: "smoothstep",
    label: "Smooth step",
    icon: (
      <svg width="20" height="14" viewBox="0 0 16 12" fill="none">
        <path d="M1 6 Q4 2 8 6 T15 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
      </svg>
    ),
  },
];

export default function CanvasToolbar({ activeTool, onToolChange }: CanvasToolbarProps) {
  const router = useRouter();
  const [shapesOpen, setShapesOpen] = useState(false);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const pendingShape = useCanvasStore((s) => s.pendingShape);
  const setPendingShape = useCanvasStore((s) => s.setPendingShape);
  const setPendingIconId = useCanvasStore((s) => (s as any).setPendingIconId);
  const pendingEdgeType = useCanvasStore((s) => s.pendingEdgeType);
  const setPendingEdgeType = useCanvasStore((s) => s.setPendingEdgeType);
  const setPendingEmoji = useCanvasStore((s) => s.setPendingEmoji);

  const handleToolClick = (tool: Tool) => {
    if (tool === "ai") {
      router.push("/ai-diagram");
      return;
    }
    setPendingShape(null);
    onToolChange(tool);
  };

  const handleShapePick = (shape: ShapeType) => {
    setPendingShape(shape);
    onToolChange("rectangle");
    setShapesOpen(false);
  };

  const handleEdgeTypePick = (type: PendingEdgeType) => {
    setPendingEdgeType(type);
    onToolChange("connector");
    setConnectorOpen(false);
  };

  const EMOJIS = ["😀","😃","😄","😁","😆","😅","🤣","😊","😇","🙂","😉","😍","🤩","🤔","😎","🤯","💡","✅","⚠️","❌","⭐","🔥","💬","📌","📁","📦","📝"];

  const handleEmojiPick = (emoji: string) => {
    setPendingEmoji(emoji);
    setPendingIconId(null);
    onToolChange("emoji");
    setEmojiOpen(false);
  };

  const handleIconPick = (iconId: string) => {
    setPendingIconId(iconId);
    setPendingEmoji(null);
    onToolChange("emoji");
    setEmojiOpen(false);
  };

  const tools: { icon: React.ReactNode; label: string; tool: Tool }[] = [
    { icon: <Pencil className="w-5 h-5" />, label: "Freehand draw", tool: "freeDraw" },
    { icon: <Eraser className="w-5 h-5" />, label: "Eraser", tool: "eraser" },
    { icon: <Brain className="w-5 h-5" />, label: "Mind map", tool: "mindMap" },
    { icon: <StickyNote className="w-5 h-5" />, label: "Sticky note", tool: "stickyNote" },
    { icon: <Type className="w-5 h-5" />, label: "Text", tool: "text" },
    { icon: <List className="w-5 h-5" />, label: "List", tool: "list" },
    { icon: <Link className="w-5 h-5" />, label: "Link", tool: "text" },
    { icon: <Image className="w-5 h-5" />, label: "Image", tool: "text" },
    { icon: <Frame className="w-5 h-5" />, label: "Frame", tool: "frame" },
    { icon: <Wand2 className="w-5 h-5" />, label: "AI Generate", tool: "ai" },
  ];

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-2 gap-1 shadow-sm">
        {/* Selection, move & pan tools */}
        <ToolButton
          icon={<MousePointer2 className="w-5 h-5" />}
          label="Select"
          tool="select"
          active={activeTool === "select"}
          onClick={() => handleToolClick("select")}
        />
        <ToolButton
          icon={<Hand className="w-5 h-5 rotate-45" />}
          label="Move nodes"
          tool="move"
          active={activeTool === "move"}
          onClick={() => handleToolClick("move")}
        />
        <ToolButton
          icon={<Hand className="w-5 h-5" />}
          label="Pan canvas"
          tool="pan"
          active={activeTool === "pan"}
          onClick={() => handleToolClick("pan")}
        />
        <div className="w-8 h-px bg-gray-200 my-1" />
      <Popover.Root open={shapesOpen} onOpenChange={setShapesOpen}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                  (pendingShape || (activeTool === "rectangle" && !pendingShape)) ? "bg-violet-100 text-violet-600" : "hover:bg-gray-100 text-gray-600"
                )}
                aria-label="Shapes menu"
              >
                <Shapes className="w-5 h-5" />
              </button>
            </Popover.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="right" sideOffset={8} className="z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700">
              All shapes
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Popover.Portal>
          <Popover.Content
            className="z-50 w-52 p-2 rounded-lg bg-white border border-gray-200 shadow-lg"
            sideOffset={8}
            side="right"
            align="start"
          >
            <div className="text-xs font-medium text-gray-500 px-2 py-1.5 border-b border-gray-100 mb-2">
              Shapes
            </div>
            <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto">
              {SHAPE_TYPES.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  onClick={() => handleShapePick(shape)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2 rounded-md text-xs transition-colors",
                    pendingShape === shape ? "bg-violet-100 text-violet-700" : "hover:bg-gray-100 text-gray-700"
                  )}
                  title={SHAPE_LABELS[shape]}
                >
                  {shape === "table" ? (
                    <svg width={20} height={20} viewBox="0 0 100 100" className="shrink-0" fill="currentColor" stroke="currentColor" strokeWidth={2}>
                      <rect x={5} y={5} width={90} height={90} fill="none" stroke="currentColor" strokeWidth={3} />
                      <line x1={38} y1={5} x2={38} y2={95} stroke="currentColor" strokeWidth={2} />
                      <line x1={62} y1={5} x2={62} y2={95} stroke="currentColor" strokeWidth={2} />
                      <line x1={5} y1={38} x2={95} y2={38} stroke="currentColor" strokeWidth={2} />
                      <line x1={5} y1={62} x2={95} y2={62} stroke="currentColor" strokeWidth={2} />
                    </svg>
                  ) : (
                    <svg width={20} height={20} viewBox="0 0 100 100" className="shrink-0 text-gray-600" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d={SHAPE_PATHS[shape]} vectorEffect="non-scaling-stroke" />
                    </svg>
                  )}
                  <span className="truncate w-full text-center">{SHAPE_LABELS[shape]}</span>
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Popover.Root open={connectorOpen} onOpenChange={setConnectorOpen}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                  activeTool === "connector" ? "bg-violet-100 text-violet-600" : "hover:bg-gray-100 text-gray-600"
                )}
                aria-label="Connector / edge"
              >
                <GitBranch className="w-5 h-5" />
              </button>
            </Popover.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="right" sideOffset={8} className="z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700">
              Connector (draw edge)
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Popover.Portal>
          <Popover.Content
            className="z-50 w-40 p-2 rounded-lg bg-white border border-gray-200 shadow-lg"
            sideOffset={8}
            side="right"
            align="start"
          >
            <div className="text-xs font-medium text-gray-500 px-2 py-1.5 border-b border-gray-100 mb-2">
              Edge type
            </div>
            <div className="flex flex-col gap-0.5">
              {EDGE_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => handleEdgeTypePick(opt.type)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors text-left",
                    pendingEdgeType === opt.type ? "bg-violet-100 text-violet-700" : "hover:bg-gray-100 text-gray-700"
                  )}
                  title={opt.label}
                >
                  <span className="shrink-0 text-gray-600">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {/* Emoji / icon nodes */}
      <Popover.Root open={emojiOpen} onOpenChange={setEmojiOpen}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={cn(
                  "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                  activeTool === "emoji" ? "bg-violet-100 text-violet-600" : "hover:bg-gray-100 text-gray-600"
                )}
                aria-label="Emoji / icon"
              >
                <Smile className="w-5 h-5" />
              </button>
            </Popover.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={8}
              className="z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700"
            >
              Emoji icon
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Popover.Portal>
          <Popover.Content
            className="z-50 w-48 p-2 rounded-lg bg-white border border-gray-200 shadow-lg"
            sideOffset={8}
            side="right"
            align="start"
          >
            <div className="text-xs font-medium text-gray-500 px-2 py-1.5 border-b border-gray-100 mb-2">
              Emoji
            </div>
            <div className="grid grid-cols-6 gap-1 px-1 pb-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiPick(emoji)}
                  className="flex items-center justify-center h-8 rounded-md text-lg hover:bg-gray-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="text-xs font-medium text-gray-500 px-2 py-1.5 border-t border-gray-100 mb-2 mt-1">
              Icons
            </div>
            <div className="grid grid-cols-4 gap-1 px-1 pb-1 max-h-56 overflow-y-auto">
              {ICON_REGISTRY.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => handleIconPick(def.id)}
                  className="flex flex-col items-center justify-center h-10 rounded-md text-[10px] gap-0.5 hover:bg-gray-100"
                  title={def.label}
                >
                  <span className="text-gray-700">
                    <def.Icon className="w-4 h-4" />
                  </span>
                  <span className="truncate w-full px-1">{def.label}</span>
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {tools
        .filter((t) => t.tool !== "connector")
        .map(({ icon, label, tool }) => (
          <ToolButton
            key={tool + label}
            icon={icon}
            label={label}
            tool={tool}
            active={activeTool === tool}
            onClick={() => handleToolClick(tool)}
          />
        ))}
    </div>
    </Tooltip.Provider>
  );
}
