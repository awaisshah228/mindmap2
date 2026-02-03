"use client";

import { FilePlus, Star, FolderOpen, Users, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isMobile?: boolean;
}

export default function AppSidebar({ isOpen = true, onClose, isMobile }: AppSidebarProps) {
  if (!isMobile && !isOpen) return null;

  return (
    <aside
      className={cn(
        "w-56 bg-gray-900 text-gray-300 flex flex-col h-full transition-transform duration-200 ease-out shrink-0",
        isMobile && "fixed left-0 top-0 bottom-0 z-50 shadow-xl",
        isMobile && !isOpen && "-translate-x-full",
        isMobile && isOpen && "translate-x-0"
      )}
    >
      <div className="p-4 flex items-center justify-between gap-2">
        {(isMobile || onClose) && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-gray-200"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors",
            onClose ? "flex-1" : "w-full"
          )}
        >
          <FilePlus className="w-4 h-4" />
          Create new
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2">
        <section>
          <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Recent
          </h3>
          <ul>
            <li>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left text-sm"
              >
                <FolderOpen className="w-4 h-4 opacity-60" />
                Untitled
              </button>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">
            Favourites
          </h3>
          <ul>
            <li>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left text-sm"
              >
                <Star className="w-4 h-4 opacity-60" />
                Welcome
              </button>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">
            Private
          </h3>
          <ul>
            <li>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left text-sm"
              >
                <FolderOpen className="w-4 h-4 opacity-60" />
                Grand
              </button>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mt-4">
            Teams
          </h3>
          <ul>
            <li>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left text-sm"
              >
                <Users className="w-4 h-4 opacity-60" />
                My Team
              </button>
            </li>
          </ul>
        </section>
      </nav>

      <div className="p-2 border-t border-gray-800">
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-800 text-left text-sm"
        >
          <Trash2 className="w-4 h-4 opacity-60" />
          Trash
        </button>
      </div>
    </aside>
  );
}
