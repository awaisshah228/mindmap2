"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import {
  StickyNote,
  Square,
  Diamond,
  Circle,
  FileText,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SHAPE_TYPES, SHAPE_LABELS, SHAPE_PATHS, type ShapeType } from "@/lib/shape-types";
import { useCanvasStore } from "@/lib/store/canvas-store";
import type { Tool } from "@/lib/store/canvas-store";

interface ToolButtonProps {
  icon: React.ReactNode;
  label: string;
  tool: Tool;
  active: boolean;
  onClick: () => void;
}

function ToolButton({ icon, label, tool, active, onClick }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
        active ? "bg-violet-100 text-violet-600" : "hover:bg-gray-100 text-gray-600"
      )}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

interface CanvasToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
}

export default function CanvasToolbar({ activeTool, onToolChange }: CanvasToolbarProps) {
  const router = useRouter();
  const [shapesOpen, setShapesOpen] = useState(false);
  const pendingShape = useCanvasStore((s) => s.pendingShape);
  const setPendingShape = useCanvasStore((s) => s.setPendingShape);

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

  const tools: { icon: React.ReactNode; label: string; tool: Tool }[] = [
    { icon: <Pencil className="w-5 h-5" />, label: "Freehand draw", tool: "freeDraw" },
    { icon: <Brain className="w-5 h-5" />, label: "Mind map", tool: "mindMap" },
    { icon: <StickyNote className="w-5 h-5" />, label: "Sticky note", tool: "stickyNote" },
    { icon: <Square className="w-5 h-5" />, label: "Rectangle", tool: "rectangle" },
    { icon: <Diamond className="w-5 h-5" />, label: "Diamond", tool: "diamond" },
    { icon: <Circle className="w-5 h-5" />, label: "Circle", tool: "circle" },
    { icon: <FileText className="w-5 h-5" />, label: "Document", tool: "document" },
    { icon: <GitBranch className="w-5 h-5" />, label: "Connector", tool: "connector" },
    { icon: <Type className="w-5 h-5" />, label: "Text", tool: "text" },
    { icon: <List className="w-5 h-5" />, label: "List", tool: "list" },
    { icon: <Link className="w-5 h-5" />, label: "Link", tool: "text" },
    { icon: <Image className="w-5 h-5" />, label: "Image", tool: "text" },
    { icon: <Frame className="w-5 h-5" />, label: "Frame", tool: "frame" },
    { icon: <Wand2 className="w-5 h-5" />, label: "AI Generate", tool: "ai" },
  ];

  return (
    <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-2 gap-1 shadow-sm">
      <Popover.Root open={shapesOpen} onOpenChange={setShapesOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            title="All shapes"
            className={cn(
              "w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
              (pendingShape || (activeTool === "rectangle" && !pendingShape)) ? "bg-violet-100 text-violet-600" : "hover:bg-gray-100 text-gray-600"
            )}
            aria-label="Shapes menu"
          >
            <Shapes className="w-5 h-5" />
          </button>
        </Popover.Trigger>
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
      {tools.map(({ icon, label, tool }) => (
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
  );
}
