"use client";

import { X, Keyboard } from "lucide-react";
import { useCanvasStore } from "@/lib/store/canvas-store";

const SHORTCUT_GROUPS = [
  {
    title: "General",
    shortcuts: [
      { keys: ["Ctrl", "Z"], label: "Undo" },
      { keys: ["Ctrl", "Shift", "Z"], label: "Redo" },
      { keys: ["Ctrl", "C"], label: "Copy" },
      { keys: ["Ctrl", "V"], label: "Paste" },
      { keys: ["Ctrl", "X"], label: "Cut" },
      { keys: ["Ctrl", "A"], label: "Select all" },
      { keys: ["Ctrl", "Shift", "A"], label: "Deselect all" },
      { keys: ["Delete"], label: "Delete selected" },
      { keys: ["Esc"], label: "Deselect / Close panel" },
    ],
  },
  {
    title: "Tools",
    shortcuts: [
      { keys: ["V"], label: "Select tool" },
      { keys: ["M"], label: "Move tool" },
      { keys: ["H"], label: "Pan tool (hand)" },
    ],
  },
  {
    title: "Node Details",
    shortcuts: [
      { keys: ["Shift", "E"], label: "Open notes panel" },
      { keys: ["Shift", "T"], label: "Open tasks panel" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["Ctrl", "F"], label: "Search nodes" },
      { keys: ["Shift", "?"], label: "Keyboard shortcuts" },
      { keys: ["P"], label: "Presentation mode" },
      { keys: ["F"], label: "Focus mode (selected node)" },
    ],
  },
  {
    title: "Presentation Mode",
    shortcuts: [
      { keys: ["\u2192"], label: "Next node" },
      { keys: ["\u2190"], label: "Previous node" },
      { keys: ["Esc"], label: "Exit presentation" },
    ],
  },
];

export function KeyboardShortcutsPanel() {
  const shortcutsOpen = useCanvasStore((s) => s.shortcutsOpen);
  const setShortcutsOpen = useCanvasStore((s) => s.setShortcutsOpen);

  if (!shortcutsOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[520px] max-w-[90vw] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-violet-600" />
            <h2 className="text-base font-semibold text-gray-900">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShortcutsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-gray-700">
                      {shortcut.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i}>
                          <kbd className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded shadow-sm">
                            {key}
                          </kbd>
                          {i < shortcut.keys.length - 1 && (
                            <span className="text-gray-400 mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">
            Press <kbd className="px-1.5 py-0.5 text-[10px] bg-gray-100 border border-gray-300 rounded">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
