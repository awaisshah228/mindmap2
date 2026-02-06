"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  X,
  FileText,
  CheckSquare,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  File,
  Check,
  Square,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasStore, type NodeTask } from "@/lib/store/canvas-store";
import { uploadWithProgress } from "@/lib/upload-with-progress";

type Tab = "notes" | "tasks" | "attachments";

export function NodeDetailsPanel() {
  const detailsPanelNodeId = useCanvasStore((s) => s.detailsPanelNodeId);
  const setDetailsPanelNodeId = useCanvasStore((s) => s.setDetailsPanelNodeId);

  if (!detailsPanelNodeId) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex pointer-events-none">
      <div className="pointer-events-auto w-[400px] max-w-full h-full bg-white border-l border-gray-200 shadow-xl flex flex-col">
        <NodeDetailsPanelContent
          nodeId={detailsPanelNodeId}
          onClose={() => setDetailsPanelNodeId(null)}
        />
      </div>
    </div>
  );
}

function NodeDetailsPanelContent({
  nodeId,
  onClose,
}: {
  nodeId: string;
  onClose: () => void;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const node = nodes.find((n) => n.id === nodeId);
  const label = (node?.data?.label as string) || "Node";
  const [activeTab, setActiveTab] = useState<Tab>("notes");

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-3 h-3 rounded-sm bg-violet-500 shrink-0" />
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            {label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <TabButton
          active={activeTab === "notes"}
          onClick={() => setActiveTab("notes")}
          icon={<FileText className="w-3.5 h-3.5" />}
          label="Notes"
        />
        <TabButton
          active={activeTab === "tasks"}
          onClick={() => setActiveTab("tasks")}
          icon={<CheckSquare className="w-3.5 h-3.5" />}
          label="Tasks"
          nodeId={nodeId}
        />
        <TabButton
          active={activeTab === "attachments"}
          onClick={() => setActiveTab("attachments")}
          icon={<Paperclip className="w-3.5 h-3.5" />}
          label="Attachments"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "notes" && <NotesTab nodeId={nodeId} />}
        {activeTab === "tasks" && <TasksTab nodeId={nodeId} />}
        {activeTab === "attachments" && <AttachmentsTab nodeId={nodeId} />}
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  nodeId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  nodeId?: string;
}) {
  const tasks = useCanvasStore((s) => (nodeId ? s.nodeTasks[nodeId] : undefined));
  const doneCount = tasks?.filter((t) => t.done).length ?? 0;
  const totalCount = tasks?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors",
        active
          ? "text-violet-700 border-b-2 border-violet-500 bg-violet-50/50"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
      )}
    >
      {icon}
      {label}
      {totalCount > 0 && label === "Tasks" && (
        <span className="text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5">
          {doneCount}/{totalCount}
        </span>
      )}
    </button>
  );
}

// ─── Notes Tab ────────────────────────────────────────────────────────

function NotesTab({ nodeId }: { nodeId: string }) {
  const note = useCanvasStore((s) => s.nodeNotes[nodeId] ?? "");
  const setNodeNote = useCanvasStore((s) => s.setNodeNote);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, [nodeId]);

  return (
    <div className="p-4 h-full">
      <textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNodeNote(nodeId, e.target.value)}
        placeholder="Write your notes here... (supports Markdown)"
        className="w-full h-full min-h-[300px] px-3 py-2 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder-gray-400 leading-relaxed"
      />
    </div>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────

const EMPTY_TASKS: NodeTask[] = [];

function TasksTab({ nodeId }: { nodeId: string }) {
  const tasksFromStore = useCanvasStore((s) => s.nodeTasks[nodeId]);
  const tasks = tasksFromStore ?? EMPTY_TASKS;
  const addNodeTask = useCanvasStore((s) => s.addNodeTask);
  const toggleNodeTask = useCanvasStore((s) => s.toggleNodeTask);
  const removeNodeTask = useCanvasStore((s) => s.removeNodeTask);
  const [newTaskText, setNewTaskText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const doneCount = tasks.filter((t) => t.done).length;
  const progress = tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0;

  const handleAddTask = useCallback(() => {
    if (!newTaskText.trim()) return;
    const task: NodeTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: newTaskText.trim(),
      done: false,
    };
    addNodeTask(nodeId, task);
    setNewTaskText("");
    inputRef.current?.focus();
  }, [nodeId, newTaskText, addNodeTask]);

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Progress bar */}
      {tasks.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{doneCount} of {tasks.length} completed</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex flex-col gap-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-2 group px-2 py-1.5 rounded hover:bg-gray-50"
          >
            <button
              type="button"
              onClick={() => toggleNodeTask(nodeId, task.id)}
              className="shrink-0 text-gray-400 hover:text-green-500"
            >
              {task.done ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <span
              className={cn(
                "flex-1 text-sm min-w-0",
                task.done && "line-through text-gray-400"
              )}
            >
              {task.text}
            </span>
            <button
              type="button"
              onClick={() => removeNodeTask(nodeId, task.id)}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add task input */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddTask();
          }}
          placeholder="Add a task..."
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={handleAddTask}
          disabled={!newTaskText.trim()}
          className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Attachments Tab ──────────────────────────────────────────────────

const EMPTY_ATTACHMENTS: import("@/lib/store/canvas-store").NodeAttachment[] = [];

type UploadingFile = { name: string; progress: number; error?: string };

function AttachmentsTab({ nodeId }: { nodeId: string }) {
  const attachmentsFromStore = useCanvasStore((s) => s.nodeAttachments[nodeId]);
  const attachments = attachmentsFromStore ?? EMPTY_ATTACHMENTS;
  const addNodeAttachment = useCanvasStore((s) => s.addNodeAttachment);
  const removeNodeAttachment = useCanvasStore((s) => s.removeNodeAttachment);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Map<string, UploadingFile>>(new Map());

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      e.target.value = "";

      const uploadApi = typeof window !== "undefined" ? `${window.location.origin}/api/upload` : "/api/upload";

      for (const file of Array.from(files)) {
        const fileKey = `${file.name}-${file.size}-${Date.now()}`;
        setUploading((prev) => new Map(prev).set(fileKey, { name: file.name, progress: 0 }));

        const result = await uploadWithProgress(
          file,
          uploadApi,
          "attachments",
          (loaded, total) => {
            setUploading((prev) => {
              const next = new Map(prev);
              const cur = next.get(fileKey);
              if (cur) next.set(fileKey, { ...cur, progress: total ? (loaded / total) * 100 : 0 });
              return next;
            });
          }
        );

        setUploading((prev) => {
          const next = new Map(prev);
          next.delete(fileKey);
          return next;
        });

        if (result.ok) {
          addNodeAttachment(nodeId, {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            url: result.url,
            type: file.type,
          });
        } else {
          const useFallback = /Upload not configured|Unauthorized|401|403|Forbidden/i.test(result.error ?? "");
          if (useFallback) {
            // Fallback to data URL when S3 not configured or not signed in
            const reader = new FileReader();
            reader.onload = () => {
              addNodeAttachment(nodeId, {
                id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                name: file.name,
                url: reader.result as string,
                type: file.type,
              });
            };
            reader.readAsDataURL(file);
          } else {
            setUploading((prev) => new Map(prev).set(fileKey, { name: file.name, progress: 100, error: result.error }));
            setTimeout(() => setUploading((p) => { const n = new Map(p); n.delete(fileKey); return n; }), 3000);
          }
        }
      }
    },
    [nodeId, addNodeAttachment]
  );

  const isImage = (type: string) => type.startsWith("image/");
  const uploadingList = Array.from(uploading.entries());

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Upload button */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadingList.length > 0}
        className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-violet-400 hover:bg-violet-50/50 text-gray-500 hover:text-violet-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {uploadingList.length > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        <span className="text-sm font-medium">{uploadingList.length > 0 ? "Uploading..." : "Upload files"}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Upload progress */}
      {uploadingList.length > 0 && (
        <div className="flex flex-col gap-2">
          {uploadingList.map(([key, { name, progress, error }]) => (
            <div key={key} className="p-2 rounded-lg border border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">{name}</span>
                {error ? (
                  <span className="text-xs text-red-500">{error}</span>
                ) : (
                  <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
                )}
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attachments list */}
      {attachments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          No attachments yet. Click above to upload files or images.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 hover:border-gray-300 group"
            >
              {isImage(att.type) ? (
                <img
                  src={att.url}
                  alt={att.name}
                  className="w-10 h-10 object-cover rounded shrink-0"
                />
              ) : (
                <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded shrink-0">
                  <File className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">
                  {att.name}
                </p>
                <p className="text-xs text-gray-400">
                  {att.type.split("/")[1]?.toUpperCase() ?? "FILE"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeNodeAttachment(nodeId, att.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
