"use client";

import { useState, useMemo, useRef } from "react";
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
  Image,
  Brain,
  Pencil,
  Shapes,
  MousePointer2,
  BoxSelect,
  Smile,
  Eraser,
  Database,
  Server,
  MessageSquare,
  User,
  Folder,
  Plus,
  Search,
  Upload,
  ImagePlus,
  Group,
  Ungroup,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SHAPE_TYPES, SHAPE_LABELS, SHAPE_PATHS, type ShapeType } from "@/lib/shape-types";
import { ICON_REGISTRY, ICON_CATEGORIES } from "@/lib/icon-registry";
import { useCanvasStore } from "@/lib/store/canvas-store";
import type { Tool } from "@/lib/store/canvas-store";
import type { PendingEdgeType } from "@/lib/store/canvas-store";
import { setDragPayload, type DragNodePayload } from "@/lib/dnd-payload";

function getDragPayloadForTool(tool: Tool): DragNodePayload | null {
  switch (tool) {
    case "mindMap": return { type: "mindMap" };
    case "databaseSchema": return { type: "databaseSchema" };
    case "service": return { type: "service" };
    case "queue": return { type: "queue" };
    case "actor": return { type: "actor" };
    case "group": return { type: "group" };
    case "stickyNote": return { type: "stickyNote" };
    case "text": return { type: "text" };
    case "list": return { type: "text" };
    case "frame": return { type: "rectangle", shape: "rectangle" };
    default: return null;
  }
}

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
            active
              ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"
              : "hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"
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

const EMOJIS = ["😀","😃","😄","😁","😆","😅","🤣","😊","😇","🙂","😉","😍","🤩","🤔","😎","🤯","💡","✅","⚠️","❌","⭐","🔥","💬","📌","📁","📦","📝"];

const IMAGE_PRESETS: { seed: string; label: string }[] = [
  { seed: "user", label: "User" },
  { seed: "server", label: "Server" },
  { seed: "database", label: "Database" },
  { seed: "api", label: "API" },
  { seed: "cloud", label: "Cloud" },
  { seed: "code", label: "Code" },
  { seed: "message", label: "Message" },
  { seed: "network", label: "Network" },
  { seed: "security", label: "Security" },
  { seed: "chart", label: "Chart" },
];

const PICSUM_BASE = "https://picsum.photos/seed";

const ADD_NODE_OPTIONS: { icon: React.ReactNode; label: string; tool: Tool }[] = [
  { icon: <Brain className="w-4 h-4" />, label: "Mind map", tool: "mindMap" },
  { icon: <Database className="w-4 h-4" />, label: "Database schema", tool: "databaseSchema" },
  { icon: <Server className="w-4 h-4" />, label: "Service", tool: "service" },
  { icon: <MessageSquare className="w-4 h-4" />, label: "Queue", tool: "queue" },
  { icon: <User className="w-4 h-4" />, label: "Actor", tool: "actor" },
  { icon: <Folder className="w-4 h-4" />, label: "Group (subflow)", tool: "group" },
  { icon: <StickyNote className="w-4 h-4" />, label: "Sticky note", tool: "stickyNote" },
  { icon: <Type className="w-4 h-4" />, label: "Text", tool: "text" },
  { icon: <List className="w-4 h-4" />, label: "List", tool: "list" },
  { icon: <Frame className="w-4 h-4" />, label: "Frame", tool: "frame" },
  { icon: <Image className="w-4 h-4" />, label: "Image", tool: "image" },
];

/** Tiny triangle in the bottom-right corner indicating a submenu. */
function SubMenuIndicator() {
  return (
    <span
      className="absolute bottom-0.5 right-0.5 border-[3px] border-transparent border-b-current border-r-current opacity-50"
      aria-hidden
    />
  );
}

export default function CanvasToolbar({ activeTool, onToolChange }: CanvasToolbarProps) {
  const router = useRouter();
  const [selectOpen, setSelectOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);
  const [connectorOpen, setConnectorOpen] = useState(false);
  const [addNodesOpen, setAddNodesOpen] = useState(false);
  const [drawOpen, setDrawOpen] = useState(false);
  const [iconsImagesOpen, setIconsImagesOpen] = useState(false);
  const [searchIconsImages, setSearchIconsImages] = useState("");
  const pendingShape = useCanvasStore((s) => s.pendingShape);
  const setPendingShape = useCanvasStore((s) => s.setPendingShape);
  const setPendingIconId = useCanvasStore((s) => (s as any).setPendingIconId);
  const pendingIconLabel = useCanvasStore((s) => s.pendingIconLabel);
  const setPendingIconLabel = useCanvasStore((s) => s.setPendingIconLabel);
  const setPendingImage = useCanvasStore((s) => s.setPendingImage);
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


  const handleIconPick = (iconId: string) => {
    setPendingIconId(iconId);
    setPendingEmoji(null);
    setPendingImage(null);
    onToolChange("emoji");
    setIconsImagesOpen(false);
  };

  const handleEmojiPickFromToolbar = (emoji: string) => {
    setPendingEmoji(emoji);
    setPendingIconId(null);
    setPendingImage(null);
    onToolChange("emoji");
    setIconsImagesOpen(false);
  };

  const handleImagePick = (url: string, label: string) => {
    setPendingImage(url, label);
    setPendingIconId(null);
    setPendingEmoji(null);
    onToolChange("image");
    setIconsImagesOpen(false);
  };

  // ── Custom upload refs & handlers ──
  const customIconInputRef = useRef<HTMLInputElement>(null);
  const customImageInputRef = useRef<HTMLInputElement>(null);
  const [customEmojiInput, setCustomEmojiInput] = useState("");

  const handleCustomIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingIconId(null);
      setPendingEmoji(null);
      setPendingImage(null);
      useCanvasStore.getState().setPendingCustomIcon(dataUrl);
      onToolChange("emoji");
      setIconsImagesOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCustomImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingImage(dataUrl, file.name.replace(/\.[^.]+$/, ""));
      setPendingIconId(null);
      setPendingEmoji(null);
      onToolChange("image");
      setIconsImagesOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCustomEmojiSubmit = () => {
    const emoji = customEmojiInput.trim();
    if (!emoji) return;
    handleEmojiPickFromToolbar(emoji);
    setCustomEmojiInput("");
  };

  const filteredIcons = useMemo(() => {
    const q = searchIconsImages.trim().toLowerCase();
    if (!q) return ICON_REGISTRY;
    return ICON_REGISTRY.filter(
      (def) =>
        def.label.toLowerCase().includes(q) ||
        def.category.toLowerCase().includes(q) ||
        def.id.toLowerCase().includes(q)
    );
  }, [searchIconsImages]);

  const filteredImages = useMemo(() => {
    const q = searchIconsImages.trim().toLowerCase();
    if (!q) return IMAGE_PRESETS;
    return IMAGE_PRESETS.filter(
      (p) =>
        p.label.toLowerCase().includes(q) || p.seed.toLowerCase().includes(q)
    );
  }, [searchIconsImages]);

  const isSelectGroup = activeTool === "select" || activeTool === "selection";
  const isDrawGroup = activeTool === "freeDraw" || activeTool === "eraser";
  const isAddNodeGroup = ADD_NODE_OPTIONS.some((o) => o.tool === activeTool);

  return (
    <Tooltip.Provider delayDuration={300}>
      <div className="w-12 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-2 gap-1 shadow-sm">
        {/* Select group: Select + Selection box */}
        <Popover.Root open={selectOpen} onOpenChange={setSelectOpen}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                    isSelectGroup ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" : "hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"
                  )}
                  aria-label="Select tools"
                >
                  <MousePointer2 className="w-5 h-5" />
                  <SubMenuIndicator />
                </button>
              </Popover.Trigger>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="right" sideOffset={8} className="z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700">
                Select &amp; pan
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Popover.Portal>
            <Popover.Content className="z-50 w-56 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg" sideOffset={8} side="right" align="start">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 mb-2">Select</div>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => { handleToolClick("select"); setSelectOpen(false); }}
                  className={cn("flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors text-left", activeTool === "select" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300")}
                >
                  <MousePointer2 className="w-4 h-4 shrink-0" />
                  <span>Select (drag node to move, drag canvas to pan)</span>
                </button>
                <button
                  type="button"
                  onClick={() => { handleToolClick("selection"); setSelectOpen(false); }}
                  className={cn("flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors text-left", activeTool === "selection" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300")}
                >
                  <BoxSelect className="w-4 h-4 shrink-0" />
                  <span>Selection box (drag on canvas to select area)</span>
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <div className="w-8 h-px bg-gray-200 dark:bg-gray-600 my-1" />
      <Popover.Root open={shapesOpen} onOpenChange={setShapesOpen}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={cn(
                  "relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                  (pendingShape || (activeTool === "rectangle" && !pendingShape)) ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" : "hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"
                )}
                aria-label="Shapes menu"
              >
                <Shapes className="w-5 h-5" />
                <SubMenuIndicator />
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
            className="z-50 w-52 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
            sideOffset={8}
            side="right"
            align="start"
          >
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 mb-2">
              Shapes
            </div>
            <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto">
              {SHAPE_TYPES.map((shape) => (
                <button
                  key={shape}
                  type="button"
                  draggable
                  onDragStart={(e) => setDragPayload(e.dataTransfer, { type: "rectangle", shape })}
                  onClick={() => handleShapePick(shape)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 p-2 rounded-md text-xs transition-colors",
                    pendingShape === shape ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300"
                  )}
                  title={`${SHAPE_LABELS[shape]} (drag to canvas)`}
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
                    <svg width={20} height={20} viewBox="0 0 100 100" className="shrink-0 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={3}>
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
                  "relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                  activeTool === "connector" ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" : "hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"
                )}
                aria-label="Connector / edge"
              >
                <GitBranch className="w-5 h-5" />
                <SubMenuIndicator />
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
            className="z-50 w-40 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
            sideOffset={8}
            side="right"
            align="start"
          >
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 mb-2">
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
                    pendingEdgeType === opt.type ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300"
                  )}
                  title={opt.label}
                >
                  <span className="shrink-0 text-gray-600 dark:text-gray-400">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
        {/* Add nodes: node types + emoji */}
        <Popover.Root open={addNodesOpen} onOpenChange={setAddNodesOpen}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                    isAddNodeGroup ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" : "hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"
                  )}
                  aria-label="Add nodes"
                >
                  <Plus className="w-5 h-5" />
                  <SubMenuIndicator />
                </button>
              </Popover.Trigger>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="right" sideOffset={8} className="z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700">
                Add nodes
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Popover.Portal>
            <Popover.Content className="z-50 w-56 max-h-[70vh] overflow-y-auto p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg" sideOffset={8} side="right" align="start">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 mb-2">Nodes</div>
              <div className="flex flex-col gap-0.5 mb-2">
                {ADD_NODE_OPTIONS.map(({ icon, label, tool }) => {
                  const dragPayload = getDragPayloadForTool(tool);
                  return (
                    <button
                      key={tool + label}
                      type="button"
                      draggable={!!dragPayload}
                      onDragStart={dragPayload ? (e) => setDragPayload(e.dataTransfer, dragPayload) : undefined}
                      onClick={() => { handleToolClick(tool); setAddNodesOpen(false); }}
                      className={cn("flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors text-left", activeTool === tool ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300")}
                    >
                      <span className="shrink-0 text-gray-600 dark:text-gray-400">{icon}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {/* Icons & images: separate toolbar with search */}
        <Popover.Root open={iconsImagesOpen} onOpenChange={(open) => { setIconsImagesOpen(open); if (!open) setSearchIconsImages(""); }}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                    activeTool === "emoji" || activeTool === "image" ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" : "hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"
                  )}
                  aria-label="Icons & images"
                >
                  <Smile className="w-5 h-5" />
                  <SubMenuIndicator />
                </button>
              </Popover.Trigger>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="right" sideOffset={8} className="z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700">
                Icons &amp; images
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Popover.Portal>
            <Popover.Content className="z-50 w-80 max-h-[75vh] overflow-hidden flex flex-col rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg" sideOffset={8} side="right" align="start">
              <div className="p-2 border-b border-gray-100 dark:border-gray-700 shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search icons or images..."
                    value={searchIconsImages}
                    onChange={(e) => setSearchIconsImages(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-2 mb-1">Label (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. API Gateway, Stripe"
                  value={pendingIconLabel ?? ""}
                  onChange={(e) => setPendingIconLabel(e.target.value.trim() || null)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 min-h-0">
                {/* ── Upload custom icon / image ── */}
                <div className="flex gap-1.5 mb-3">
                  <input ref={customIconInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomIconUpload} />
                  <input ref={customImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCustomImageUpload} />
                  <button
                    type="button"
                    onClick={() => customIconInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-400 text-gray-600 dark:text-gray-400 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload Icon
                  </button>
                  <button
                    type="button"
                    onClick={() => customImageInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs rounded-lg border border-dashed border-gray-300 dark:border-gray-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-400 text-gray-600 dark:text-gray-400 transition-colors"
                  >
                    <ImagePlus className="w-3.5 h-3.5" />
                    Upload Image
                  </button>
                </div>

                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1 py-1.5 border-b border-gray-100 dark:border-gray-700 mb-2">Icons</div>
                <div className="grid grid-cols-6 gap-1 mb-4 max-h-44 overflow-y-auto">
                  {filteredIcons.map((def) => (
                    <button
                      key={def.id}
                      type="button"
                      draggable
                      onDragStart={(e) => setDragPayload(e.dataTransfer, { type: "icon", data: { iconId: def.id } })}
                      onClick={() => handleIconPick(def.id)}
                      className="flex flex-col items-center justify-center h-10 rounded-md text-[10px] gap-0.5 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={`${def.label} (drag to canvas)`}
                    >
                      <def.Icon className="w-4 h-4 text-gray-700 dark:text-gray-300 shrink-0" />
                      <span className="truncate w-full px-0.5">{def.label}</span>
                    </button>
                  ))}
                </div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1 py-1.5 border-t border-gray-100 dark:border-gray-700 pt-2 mb-2">Emoji</div>
                {/* Custom emoji input */}
                <div className="flex gap-1.5 mb-2">
                  <input
                    type="text"
                    placeholder="Type or paste emoji..."
                    value={customEmojiInput}
                    onChange={(e) => setCustomEmojiInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleCustomEmojiSubmit(); }}
                    className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={handleCustomEmojiSubmit}
                    disabled={!customEmojiInput.trim()}
                    className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>
                <div className="grid grid-cols-8 gap-1 mb-4">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      draggable
                      onDragStart={(e) => setDragPayload(e.dataTransfer, { type: "icon", data: { emoji } })}
                      onClick={() => handleEmojiPickFromToolbar(emoji)}
                      className="flex items-center justify-center h-8 rounded-md text-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1 py-1.5 border-t border-gray-100 dark:border-gray-700 pt-2 mb-2">Images</div>
                <div className="grid grid-cols-3 gap-2">
                  {filteredImages.map((preset) => (
                    <button
                      key={preset.seed}
                      type="button"
                      draggable
                      onDragStart={(e) => setDragPayload(e.dataTransfer, { type: "image", data: { imageUrl: `${PICSUM_BASE}/${preset.seed}/200/150`, label: preset.label } })}
                      onClick={() => handleImagePick(`${PICSUM_BASE}/${preset.seed}/200/150`, preset.label)}
                      className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-violet-300 dark:hover:border-violet-500 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors"
                    >
                      <img src={`${PICSUM_BASE}/${preset.seed}/80/60`} alt="" className="w-full aspect-[4/3] object-cover bg-gray-100" draggable={false} />
                      <span className="text-[10px] py-1 px-1 truncate text-center text-gray-600">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        {/* Draw: freehand + eraser */}
        <Popover.Root open={drawOpen} onOpenChange={setDrawOpen}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  className={cn(
                    "relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors",
                    isDrawGroup ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" : "hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400"
                  )}
                  aria-label="Draw"
                >
                  <Pencil className="w-5 h-5" />
                  <SubMenuIndicator />
                </button>
              </Popover.Trigger>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content side="right" sideOffset={8} className="z-[100] px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700">
                Draw
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Popover.Portal>
            <Popover.Content className="z-50 w-48 p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg" sideOffset={8} side="right" align="start">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 mb-2">Draw</div>
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => { handleToolClick("freeDraw"); setDrawOpen(false); }}
                  className={cn("flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors text-left", activeTool === "freeDraw" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300")}
                >
                  <Pencil className="w-4 h-4 shrink-0" />
                  Freehand draw
                </button>
                <button
                  type="button"
                  onClick={() => { handleToolClick("eraser"); setDrawOpen(false); }}
                  className={cn("flex items-center gap-2 px-2 py-2 rounded-md text-xs transition-colors text-left", activeTool === "eraser" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300")}
                >
                  <Eraser className="w-4 h-4 shrink-0" />
                  Eraser
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <div className="w-8 h-px bg-gray-200 dark:bg-gray-600 my-1" />
        {/* Group / Ungroup selected nodes */}
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400 transition-colors"
              aria-label="Group selected nodes (⌘G)"
              onClick={() => {
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "g", metaKey: true, ctrlKey: true, bubbles: true }));
              }}
            >
              <Group className="w-5 h-5" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="right" sideOffset={8} className="z-100 px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700">
              <span>Group selected </span><kbd className="ml-1 px-1 py-0.5 bg-gray-700 rounded text-[10px]">⌘G</kbd>
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 dark:hover:bg-gray-700 dark:text-gray-400 transition-colors"
              aria-label="Ungroup selected (⌘⇧G)"
              onClick={() => {
                document.dispatchEvent(new KeyboardEvent("keydown", { key: "g", metaKey: true, ctrlKey: true, shiftKey: true, bubbles: true }));
              }}
            >
              <Ungroup className="w-5 h-5" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content side="right" sideOffset={8} className="z-100 px-2.5 py-1.5 text-xs font-medium text-white bg-gray-800 rounded shadow-lg border border-gray-700">
              <span>Ungroup selected </span><kbd className="ml-1 px-1 py-0.5 bg-gray-700 rounded text-[10px]">⌘⇧G</kbd>
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
        <div className="w-8 h-px bg-gray-200 dark:bg-gray-600 my-1" />
        <ToolButton icon={<Wand2 className="w-5 h-5" />} label="AI Generate" tool="ai" active={false} onClick={() => handleToolClick("ai")} />
    </div>
    </Tooltip.Provider>
  );
}
