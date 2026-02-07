"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Search } from "lucide-react";
import {
  ICON_REGISTRY,
  ICON_CATEGORIES,
  type IconDefinition,
} from "@/lib/icon-registry";
import { getLocalUserIcons, addLocalUserIcon } from "@/lib/local-user-icons";

const EMOJI_QUICK_PICK = [
  "😀", "😊", "👍", "🎉", "💡", "⚡", "🔥", "📌", "⭐", "✅",
  "❌", "📝", "🏠", "🚀", "💻", "🎯", "📧", "🔒", "📦", "🎨",
  "🛠️", "👤", "🔔", "📊", "💾", "🌐", "⚙️", "🎵", "💬", "📅",
];

export type IconImageReplacerMode = "icon" | "image";

interface IconImageReplacerPanelProps {
  mode: IconImageReplacerMode;
  trigger: React.ReactNode;
  /** For icon nodes */
  iconId?: string | null;
  emoji?: string | null;
  customIcon?: string | null;
  iconUrl?: string | null;
  onIconIdChange?: (id: string | null) => void;
  onEmojiChange?: (emoji: string | null) => void;
  onCustomIconChange?: (dataUrl: string | null) => void;
  onIconUrlChange?: (url: string | null) => void;
  /** For image nodes */
  imageUrl?: string | null;
  onImageUrlChange?: (url: string | null) => void;
  onImageUpload?: (dataUrl: string) => void;
  className?: string;
}

export function IconImageReplacerPanel({
  mode,
  trigger,
  iconId,
  emoji,
  customIcon,
  iconUrl,
  onIconIdChange,
  onEmojiChange,
  onCustomIconChange,
  onIconUrlChange,
  imageUrl,
  onImageUrlChange,
  onImageUpload,
  className,
}: IconImageReplacerPanelProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [activeTab, setActiveTab] = useState<"icons" | "emoji" | "upload" | "url" | "library">("icons");
  const [localLibrary, setLocalLibrary] = useState<{ key: string; url: string; filename?: string }[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) setLocalLibrary(getLocalUserIcons());
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      addLocalUserIcon({ url: dataUrl, filename: file.name, mimeType: file.type });
      setLocalLibrary(getLocalUserIcons());
      if (mode === "icon") {
        onCustomIconChange?.(dataUrl);
      } else {
        onImageUpload?.(dataUrl);
      }
      setOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePickFromLibrary = (url: string) => {
    if (mode === "icon") {
      onCustomIconChange?.(url);
    } else {
      onImageUrlChange?.(url);
    }
    setOpen(false);
  };

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (mode === "icon") {
      onIconUrlChange?.(trimmed);
    } else {
      onImageUrlChange?.(trimmed);
    }
    setOpen(false);
    setUrlInput("");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ICON_REGISTRY;
    return ICON_REGISTRY.filter(
      (def) =>
        def.label.toLowerCase().includes(q) ||
        def.category.toLowerCase().includes(q) ||
        def.id.toLowerCase().includes(q)
    );
  }, [search]);

  const byCategory = useMemo(() => {
    const map = new Map<string, IconDefinition[]>();
    for (const def of filtered) {
      const cat = def.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(def);
    }
    return map;
  }, [filtered]);

  const clearAll = () => {
    if (mode === "icon") {
      onIconIdChange?.(null);
    } else {
      onImageUrlChange?.(null);
    }
    setOpen(false);
  };

  const hasContent =
    mode === "icon"
      ? !!(iconId || emoji || customIcon || iconUrl)
      : !!imageUrl;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={`z-50 w-80 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-xl overflow-hidden ${className ?? ""}`}
          sideOffset={8}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {mode === "icon" ? "Replace icon" : "Replace image"}
            </div>
          </div>

          {mode === "icon" && (
            <div className="flex border-b border-gray-100 dark:border-gray-700 flex-wrap">
              {(["icons", "emoji", "upload", "library", "url"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? "text-violet-600 dark:text-violet-400 border-b-2 border-violet-600 dark:border-violet-400 bg-violet-50/50 dark:bg-violet-900/20"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {mode === "icon" && activeTab === "icons" && (
            <>
              <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search icons..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {Array.from(byCategory.entries()).map(([categoryKey, icons]) => (
                  <div key={categoryKey} className="mb-3">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1 py-1.5">
                      {ICON_CATEGORIES[categoryKey] ?? categoryKey}
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {icons.map((def) => {
                        const Icon = def.Icon;
                        const isSelected = iconId === def.id;
                        return (
                          <button
                            key={def.id}
                            type="button"
                            onClick={() => {
                              onIconIdChange?.(isSelected ? null : def.id);
                              if (!isSelected) setOpen(false);
                            }}
                            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                              isSelected
                                ? "bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400"
                                : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                            }`}
                            title={def.label}
                          >
                            <Icon className="w-5 h-5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {mode === "icon" && activeTab === "emoji" && (
            <div className="p-3">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Emoji</div>
              <div className="grid grid-cols-10 gap-1.5">
                {EMOJI_QUICK_PICK.map((e) => {
                  const isSelected = emoji === e;
                  return (
                    <button
                      key={e}
                      type="button"
                      onClick={() => {
                        onEmojiChange?.(isSelected ? null : e);
                        if (!isSelected) setOpen(false);
                      }}
                      className={`flex items-center justify-center w-8 h-8 rounded-lg text-xl transition-colors ${
                        isSelected
                          ? "bg-violet-100 dark:bg-violet-900/50 ring-1 ring-violet-400"
                          : "hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                      title={e}
                    >
                      {e}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "icon" && activeTab === "library" && (
            <div className="p-3 max-h-48 overflow-y-auto">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">My library</div>
              {localLibrary.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No uploads yet. Upload in the Upload tab or from the side toolbar.</p>
              ) : (
                <div className="grid grid-cols-5 gap-1.5">
                  {localLibrary.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handlePickFromLibrary(item.url)}
                      className="aspect-square flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 overflow-hidden p-0.5"
                      title={item.filename ?? "Image"}
                    >
                      <img src={item.url} alt="" className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(mode === "icon" && activeTab === "upload") && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Upload custom icon
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
              >
                Choose file...
              </button>
              {customIcon && (
                <div className="mt-2 flex justify-center">
                  <img
                    src={customIcon}
                    alt="Preview"
                    className="w-12 h-12 object-contain rounded border border-gray-200 dark:border-gray-600"
                  />
                </div>
              )}
            </div>
          )}

          {mode === "image" && (
            <div className="p-3 space-y-3">
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Upload image
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1.5">Saved to local library (like side toolbar)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full px-4 py-2.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  Choose file...
                </button>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Or paste image URL
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={handleUrlSubmit}
                    className="px-3 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
              {imageUrl && (
                <div className="flex justify-center">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-16 h-16 object-contain rounded border border-gray-200 dark:border-gray-600"
                  />
                </div>
              )}
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  My library
                </div>
                {localLibrary.length === 0 ? (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">No uploads yet. Upload above or from the side toolbar.</p>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5 max-h-24 overflow-y-auto">
                    {localLibrary.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handlePickFromLibrary(item.url)}
                        className="aspect-square flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 overflow-hidden p-0.5"
                        title={item.filename ?? "Image"}
                      >
                        <img src={item.url} alt="" className="w-full h-full object-contain" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {mode === "icon" && activeTab === "url" && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Icon/image URL
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  className="px-3 py-2 text-sm rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {hasContent && (
            <div className="p-2 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
              >
                Clear
              </button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
