"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Search, X } from "lucide-react";
import {
  ICON_REGISTRY,
  ICON_CATEGORIES,
  getIconById,
  type IconDefinition,
} from "@/lib/icon-registry";

interface IconPickerPanelProps {
  value: string | null | undefined;
  onChange: (iconId: string | null) => void;
  customIcon?: string | null;
  onCustomIconChange?: (dataUrl: string | null) => void;
  trigger: React.ReactNode;
  className?: string;
}

export function IconPickerPanel({
  value,
  onChange,
  customIcon,
  onCustomIconChange,
  trigger,
  className,
}: IconPickerPanelProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onCustomIconChange) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onCustomIconChange(dataUrl);
      setOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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

  const selectedDef = getIconById(value);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={`z-50 w-72 rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden ${className ?? ""}`}
          sideOffset={8}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search icons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
          {onCustomIconChange != null && (
            <div className="p-2 border-b border-gray-100">
              <div className="text-xs font-medium text-gray-500 px-1 py-1.5">Custom icon</div>
              <div className="flex items-center gap-2">
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
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
                >
                  Upload image
                </button>
                {customIcon && (
                  <button
                    type="button"
                    onClick={() => { onCustomIconChange(null); setOpen(false); }}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                  >
                    Clear
                  </button>
                )}
              </div>
              {customIcon && (
                <div className="mt-2 flex justify-center">
                  <img src={customIcon} alt="Custom" className="w-8 h-8 object-contain rounded border border-gray-200" />
                </div>
              )}
            </div>
          )}
          <div className="max-h-80 overflow-y-auto p-2">
            {Array.from(byCategory.entries()).map(([categoryKey, icons]) => (
              <div key={categoryKey} className="mb-3">
                <div className="text-xs font-medium text-gray-500 px-1 py-1.5">
                  {ICON_CATEGORIES[categoryKey] ?? categoryKey}
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {icons.map((def) => {
                    const Icon = def.Icon;
                    const isSelected = value === def.id;
                    return (
                      <button
                        key={def.id}
                        type="button"
                        onClick={() => {
                          onChange(isSelected ? null : def.id);
                          if (!isSelected) setOpen(false);
                        }}
                        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                          isSelected ? "bg-violet-100 text-violet-600" : "hover:bg-gray-100 text-gray-600"
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
          {value && (
            <div className="p-2 border-t border-gray-100 flex items-center justify-between gap-2">
              <span className="text-xs text-gray-500">Selected</span>
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); }}
                className="text-xs text-gray-500 hover:text-red-600"
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

