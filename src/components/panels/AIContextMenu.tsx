"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wand2,
  GitBranch,
  HelpCircle,
  Lightbulb,
  Scale,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore } from "@/lib/store/canvas-store";

interface AIContextMenuProps {
  nodeId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function AIContextMenu({ nodeId, x, y, onClose }: AIContextMenuProps) {
  const router = useRouter();
  const nodes = useCanvasStore((s) => s.nodes);
  const node = nodes.find((n) => n.id === nodeId);
  const label = (node?.data?.label as string) || "Node";
  const aiPrompts = useCanvasStore((s) => s.aiPrompts);
  const [loading, setLoading] = useState<string | null>(null);

  const handleAIAction = useCallback(
    async (promptTemplate: string, promptId: string) => {
      setLoading(promptId);

      if (node?.type === "mindMap") {
        router.push(
          `/ai-diagram?mode=mindmap-refine&nodeId=${encodeURIComponent(nodeId)}&label=${encodeURIComponent(label)}`
        );
        onClose();
        return;
      }

      const resolvedPrompt = promptTemplate.replace(/\{label\}/g, label);
      router.push(`/ai-diagram?prompt=${encodeURIComponent(resolvedPrompt)}`);
      onClose();
    },
    [nodeId, label, node, router, onClose]
  );

  const BUILT_IN_ACTIONS = [
    {
      id: "generate-branch",
      icon: <GitBranch className="w-4 h-4" />,
      label: "Generate branch",
      description: "Create child topics",
    },
    {
      id: "generate-questions",
      icon: <HelpCircle className="w-4 h-4" />,
      label: "Generate questions",
      description: "Explore with questions",
    },
    {
      id: "expand-ideas",
      icon: <Lightbulb className="w-4 h-4" />,
      label: "Expand ideas",
      description: "Break down further",
    },
    {
      id: "pros-cons",
      icon: <Scale className="w-4 h-4" />,
      label: "Pros & Cons",
      description: "Evaluate tradeoffs",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[200]"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Menu */}
      <div
        className="fixed z-[201] min-w-[220px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 overflow-hidden"
        style={{ left: x, top: y }}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              AI Actions
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">
            for &quot;{label}&quot;
          </p>
        </div>

        {/* Built-in actions */}
        {BUILT_IN_ACTIONS.map((action) => {
          const promptTemplate =
            aiPrompts.find((p) => p.id === action.id)?.prompt ?? "";
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAIAction(promptTemplate, action.id)}
              disabled={!!loading}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors",
                loading === action.id && "bg-violet-50 dark:bg-violet-900/20"
              )}
            >
              <span className="text-violet-600 dark:text-violet-400 shrink-0">
                {loading === action.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  action.icon
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {action.label}
                </p>
                <p className="text-[10px] text-gray-400">
                  {action.description}
                </p>
              </div>
              <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
            </button>
          );
        })}

        {/* Custom prompts */}
        {aiPrompts
          .filter(
            (p) =>
              !BUILT_IN_ACTIONS.some((a) => a.id === p.id) && p.prompt.trim()
          )
          .map((prompt) => (
            <button
              key={prompt.id}
              type="button"
              onClick={() => handleAIAction(prompt.prompt, prompt.id)}
              disabled={!!loading}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
            >
              <Wand2 className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                {prompt.label}
              </span>
              <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
            </button>
          ))}

        {/* Divider + Open AI panel */}
        <div className="border-t border-gray-100 dark:border-gray-800 mt-1 pt-1">
          <button
            type="button"
            onClick={() => {
              router.push("/ai-diagram");
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Wand2 className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Open AI Panel...
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
