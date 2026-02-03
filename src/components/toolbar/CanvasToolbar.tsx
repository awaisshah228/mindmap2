"use client";

import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
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

  const handleToolClick = (tool: Tool) => {
    if (tool === "ai") {
      router.push("/ai-diagram");
      return;
    }
    onToolChange(tool);
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
