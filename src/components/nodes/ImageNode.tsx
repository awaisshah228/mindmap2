"use client";

import { memo, useState } from "react";
import { Handle, type NodeProps, Position } from "@xyflow/react";
import { BaseNode } from "./BaseNode";
import { EditableNodeContent } from "./EditableNodeContent";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 120;

interface ImageNodeData {
  label?: string;
  imageUrl?: string;
  image?: string; // alias for imageUrl
}

function ImageNode({ id, data, selected }: NodeProps) {
  const { label = "", imageUrl, image } = (data || {}) as ImageNodeData;
  const src = imageUrl || image || "";
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <BaseNode
      nodeId={id}
      selected={selected}
      className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
      style={{ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT }}
      minWidth={80}
      minHeight={60}
    >
      <Handle id="left" type="source" position={Position.Left} className="node-connect-handle" />
      <Handle id="right" type="source" position={Position.Right} className="node-connect-handle" />
      <Handle id="top" type="source" position={Position.Top} className="node-connect-handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="node-connect-handle" />

      <div className="w-full h-full flex flex-col">
        <div className="flex-1 min-h-0 relative flex items-center justify-center bg-gray-100">
          {src && !loadError ? (
            <img
              src={src}
              alt={typeof label === "string" ? label : "Image"}
              className={cn(
                "max-w-full max-h-full object-contain transition-opacity",
                loaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => {
                setLoaded(true);
                setLoadError(false);
              }}
              onError={() => setLoadError(true)}
            />
          ) : null}
          {(!src || loadError) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-gray-400 p-2">
              <ImageOff className="w-8 h-8 shrink-0" />
              <span className="text-xs text-center">
                {src ? "Image failed to load" : "No image URL"}
              </span>
            </div>
          )}
          {src && !loaded && !loadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}
        </div>
        {label != null && String(label).trim() !== "" && (
          <div className="shrink-0 px-2 py-1 border-t border-gray-200 bg-white/90 min-h-0">
            <EditableNodeContent
              nodeId={id}
              value={String(label)}
              placeholder="Caption"
              className="text-xs text-center text-gray-700 truncate outline-none w-full"
            />
          </div>
        )}
      </div>
    </BaseNode>
  );
}

export default memo(ImageNode);
