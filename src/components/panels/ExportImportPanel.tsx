"use client";

import { useCallback, useRef } from "react";
import { Download, Upload, X, FileJson, FileText, FileCode } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasStore } from "@/lib/store/canvas-store";

interface ExportImportPanelProps {
  open: boolean;
  onClose: () => void;
}

export function ExportImportPanel({ open, onClose }: ExportImportPanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const nodeNotes = useCanvasStore((s) => s.nodeNotes);
  const nodeTasks = useCanvasStore((s) => s.nodeTasks);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const setPendingFitView = useCanvasStore((s) => s.setPendingFitView);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Export as JSON
  const handleExportJSON = useCallback(() => {
    const data = {
      version: 1,
      nodes,
      edges,
      nodeNotes,
      nodeTasks,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagram-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, nodeNotes, nodeTasks]);

  // Export as Markdown
  const handleExportMarkdown = useCallback(() => {
    let md = "# Diagram Export\n\n";

    // Nodes
    md += "## Nodes\n\n";
    nodes.forEach((node) => {
      const label = (node.data?.label as string) || "Untitled";
      const type = node.type || "node";
      md += `### ${label}\n`;
      md += `- **Type**: ${type}\n`;
      md += `- **Position**: (${Math.round(node.position.x)}, ${Math.round(node.position.y)})\n`;

      const note = nodeNotes[node.id];
      if (note) {
        md += `\n${note}\n`;
      }

      const tasks = nodeTasks[node.id];
      if (tasks?.length) {
        md += "\n**Tasks:**\n";
        tasks.forEach((t) => {
          md += `- [${t.done ? "x" : " "}] ${t.text}\n`;
        });
      }
      md += "\n";
    });

    // Edges
    if (edges.length > 0) {
      md += "## Connections\n\n";
      edges.forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        const sourceLabel = (sourceNode?.data?.label as string) || edge.source;
        const targetLabel = (targetNode?.data?.label as string) || edge.target;
        const edgeLabel = (edge.data?.label as string) || "";
        md += `- ${sourceLabel} ${edgeLabel ? `--${edgeLabel}-->` : "-->"} ${targetLabel}\n`;
      });
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagram-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, nodeNotes, nodeTasks]);

  // Export as SVG (extracts the React Flow SVG edges + renders node labels)
  const handleExportSVG = useCallback(() => {
    const reactFlowEl = document.querySelector(".react-flow");
    if (!reactFlowEl) return;

    // Clone the SVG layer for edges
    const svgEdges = reactFlowEl.querySelector(".react-flow__edges svg");
    if (!svgEdges) {
      // Fallback to JSON export if no SVG found
      handleExportJSON();
      return;
    }

    const clone = svgEdges.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "1920");
    clone.setAttribute("height", "1080");

    const svgString = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diagram-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [handleExportJSON]);

  // Import JSON
  const handleImportJSON = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          if (data.nodes && Array.isArray(data.nodes)) {
            setNodes(data.nodes);
          }
          if (data.edges && Array.isArray(data.edges)) {
            setEdges(data.edges);
          }
          if (data.nodeNotes) {
            Object.entries(data.nodeNotes).forEach(([id, note]) => {
              useCanvasStore.getState().setNodeNote(id, note as string);
            });
          }
          if (data.nodeTasks) {
            Object.entries(data.nodeTasks).forEach(([id, tasks]) => {
              useCanvasStore.getState().setNodeTasks(id, tasks as any);
            });
          }
          setPendingFitView(true);
          onClose();
        } catch {
          alert("Failed to parse JSON file. Please make sure it's a valid diagram export.");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [setNodes, setEdges, setPendingFitView, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[420px] max-w-[90vw] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Export / Import
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Export section */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Export
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <ExportButton
                icon={<FileJson className="w-5 h-5" />}
                label="JSON"
                description="Full data"
                onClick={handleExportJSON}
              />
              <ExportButton
                icon={<FileText className="w-5 h-5" />}
                label="Markdown"
                description="Text format"
                onClick={handleExportMarkdown}
              />
              <ExportButton
                icon={<FileCode className="w-5 h-5" />}
                label="SVG"
                description="Vector"
                onClick={handleExportSVG}
              />
            </div>
          </div>

          {/* Import section */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Import
            </h3>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 text-gray-500 hover:text-violet-600 transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-sm font-medium">Import JSON file</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 px-3 py-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/20 transition-colors"
    >
      <span className="text-gray-600 dark:text-gray-400">{icon}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
        {label}
      </span>
      <span className="text-[10px] text-gray-400">{description}</span>
    </button>
  );
}
