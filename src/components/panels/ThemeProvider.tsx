"use client";

import { useEffect } from "react";
import { useCanvasStore, type ThemeMode } from "@/lib/store/canvas-store";

const THEMES: { value: ThemeMode; label: string; colors: { bg: string; fg: string; accent: string } }[] = [
  { value: "light", label: "Light", colors: { bg: "#f3f4f6", fg: "#111827", accent: "#7c3aed" } },
  { value: "dark", label: "Dark", colors: { bg: "#1f2937", fg: "#f9fafb", accent: "#8b5cf6" } },
  { value: "system", label: "System", colors: { bg: "", fg: "", accent: "" } },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useCanvasStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // system
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  return <>{children}</>;
}

export function ThemeSwitcher() {
  const theme = useCanvasStore((s) => s.theme);
  const setTheme = useCanvasStore((s) => s.setTheme);

  return (
    <div className="flex items-center gap-1">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => setTheme(t.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            theme === t.value
              ? "bg-violet-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export { THEMES };
