"use client";

import type { ViewMode } from "@/types";

const TABS: { mode: ViewMode; label: string; icon: string }[] = [
  { mode: "list", label: "List", icon: "☰" },
  { mode: "calendar", label: "Calendar", icon: "📅" },
  { mode: "gantt", label: "Gantt", icon: "📊" },
];

interface Props {
  active: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewTabs({ active, onChange }: Props) {
  return (
    <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900/50">
      {TABS.map((t) => (
        <button
          key={t.mode}
          onClick={() => onChange(t.mode)}
          disabled={t.mode === "gantt"}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition
            ${active === t.mode
              ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
              : t.mode === "gantt"
                ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
        >
          <span>{t.icon}</span> {t.label}
          {t.mode === "gantt" && <span className="text-[10px] text-gray-400">(soon)</span>}
        </button>
      ))}
    </div>
  );
}
