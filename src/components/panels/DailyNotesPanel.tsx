"use client";

import { useMemo } from "react";
import { X, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useCanvasStore } from "@/lib/store/canvas-store";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function DailyNotesPanel() {
  const dailyNotesOpen = useCanvasStore((s) => s.dailyNotesOpen);
  const setDailyNotesOpen = useCanvasStore((s) => s.setDailyNotesOpen);
  const dailyNotes = useCanvasStore((s) => s.dailyNotes);
  const setDailyNote = useCanvasStore((s) => s.setDailyNote);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const dateKey = formatDate(currentDate);
  const note = dailyNotes[dateKey] ?? "";

  const prevDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const nextDay = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  const isToday = formatDate(new Date()) === dateKey;

  // Recent dates with notes
  const recentDates = useMemo(() => {
    return Object.keys(dailyNotes)
      .filter((k) => dailyNotes[k].trim().length > 0)
      .sort()
      .reverse()
      .slice(0, 10);
  }, [dailyNotes]);

  if (!dailyNotesOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex pointer-events-none">
      <div className="pointer-events-auto w-[400px] max-w-full h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Daily Notes
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setDailyNotesOpen(false)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Date navigation */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            type="button"
            onClick={prevDay}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {formatDisplayDate(currentDate)}
            </p>
            {!isToday && (
              <button
                type="button"
                onClick={goToToday}
                className="text-xs text-violet-600 hover:text-violet-700"
              >
                Go to today
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={nextDay}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Note editor */}
        <div className="flex-1 p-4">
          <textarea
            value={note}
            onChange={(e) => setDailyNote(dateKey, e.target.value)}
            placeholder="Write your daily notes, meeting notes, journal..."
            className="w-full h-full min-h-[200px] px-3 py-2 text-sm text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder-gray-400 leading-relaxed"
          />
        </div>

        {/* Recent notes */}
        {recentDates.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Recent Notes
            </p>
            <div className="flex flex-wrap gap-1">
              {recentDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setCurrentDate(new Date(date + "T12:00:00"))}
                  className={`px-2 py-1 text-xs rounded ${
                    dateKey === date
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
