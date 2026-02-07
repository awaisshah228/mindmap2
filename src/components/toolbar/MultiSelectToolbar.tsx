"use client";

import { Panel, useStore } from "@xyflow/react";
import { Group } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating toolbar when 2+ nodes are selected (Shift+click or box select).
 * Shows "Group Nodes" button — same action as ⌘G.
 * @see https://reactflow.dev/examples/grouping/selection-grouping
 */
export function MultiSelectToolbar() {
  const selectedCount = useStore((s) =>
    s.nodes.filter((n) => n.selected && n.type !== "group").length
  );

  const handleGroupNodes = () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "g",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      })
    );
  };

  if (selectedCount < 2) return null;

  return (
    <Panel
      position="top-center"
      className={cn(
        "!mt-3 flex items-center gap-2 rounded-lg px-3 py-2 shadow-lg",
        "bg-gray-800/95 text-gray-200 border border-gray-700",
        "backdrop-blur-sm"
      )}
    >
      <span className="text-xs text-gray-400">
        {selectedCount} selected
      </span>
      <button
        type="button"
        onClick={handleGroupNodes}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium",
          "bg-violet-600 hover:bg-violet-500 text-white transition-colors"
        )}
        aria-label="Group nodes (⌘G)"
        title="Group nodes (⌘G)"
      >
        <Group className="w-4 h-4" />
        Group nodes
      </button>
    </Panel>
  );
}
