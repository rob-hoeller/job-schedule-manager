"use client";

import { useMemo, useState } from "react";
import type { Activity, Dependency, CalendarDay } from "@/types";
import { StatusBadge } from "./StatusBadge";
import { formatDate } from "@/lib/utils";

/* ── colour map for activity bars ── */
const BAR_COLORS: Record<string, string> = {
  Released: "bg-blue-500/80 dark:bg-blue-600/70",
  Approved: "bg-green-500/80 dark:bg-green-600/70",
  Completed: "bg-gray-400/80 dark:bg-gray-500/70",
};
function barColor(status: string) {
  return BAR_COLORS[status] ?? "bg-gray-400/80";
}

/* ── date helpers ── */
function toKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  activities: Activity[];
  dependencies: Dependency[];
  calendarDays: Map<string, CalendarDay>;
}

/* ── detail popup ── */
function DetailPopup({
  activity: a,
  predecessors,
  successors,
  activityMap,
  onClose,
}: {
  activity: Activity;
  predecessors: Dependency[];
  successors: Dependency[];
  activityMap: Map<number, Activity>;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold">{a.description}</h3>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="text-gray-500">Trade: </span>{a.trade_partner_name ?? "—"}</p>
          <p><span className="text-gray-500">Status: </span><StatusBadge status={a.status} /></p>
          <p><span className="text-gray-500">Start: </span>{formatDate(a.current_start_date)}</p>
          <p><span className="text-gray-500">End: </span>{formatDate(a.current_end_date)}</p>
          <p><span className="text-gray-500">Duration: </span>{a.current_duration ?? "—"} days</p>
        </div>
        {(predecessors.length > 0 || successors.length > 0) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Predecessors</p>
              {predecessors.filter((d) => activityMap.has(d.predecessor_jsa_rid)).length === 0 ? (
                <span className="text-xs text-gray-400 italic">None</span>
              ) : (
                <ul className="space-y-0.5">
                  {predecessors.filter((d) => activityMap.has(d.predecessor_jsa_rid)).map((d) => (
                    <li key={d.job_schedule_activity_dependency_id} className="text-xs">
                      {d.dependency_type}{d.lag_days !== 0 && ` (${d.lag_days > 0 ? "+" : ""}${d.lag_days})`} — {activityMap.get(d.predecessor_jsa_rid)!.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Successors</p>
              {successors.filter((d) => activityMap.has(d.successor_jsa_rid)).length === 0 ? (
                <span className="text-xs text-gray-400 italic">None</span>
              ) : (
                <ul className="space-y-0.5">
                  {successors.filter((d) => activityMap.has(d.successor_jsa_rid)).map((d) => (
                    <li key={d.job_schedule_activity_dependency_id} className="text-xs">
                      {d.dependency_type}{d.lag_days !== 0 && ` (${d.lag_days > 0 ? "+" : ""}${d.lag_days})`} — {activityMap.get(d.successor_jsa_rid)!.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── main component ── */
export function CalendarView({ activities, dependencies, calendarDays }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Activity | null>(null);

  const activityMap = useMemo(
    () => new Map(activities.map((a) => [a.jsa_rid, a])),
    [activities],
  );

  const predMap = useMemo(() => {
    const m = new Map<number, Dependency[]>();
    for (const d of dependencies) {
      const arr = m.get(d.successor_jsa_rid) ?? [];
      arr.push(d);
      m.set(d.successor_jsa_rid, arr);
    }
    return m;
  }, [dependencies]);

  const succMap = useMemo(() => {
    const m = new Map<number, Dependency[]>();
    for (const d of dependencies) {
      const arr = m.get(d.predecessor_jsa_rid) ?? [];
      arr.push(d);
      m.set(d.predecessor_jsa_rid, arr);
    }
    return m;
  }, [dependencies]);

  /* Build calendar grid cells */
  const cells = useMemo(() => {
    const first = startOfMonth(year, month);
    const startDow = first.getDay(); // 0=Sun
    const gridStart = addDays(first, -startDow);
    const result: Date[] = [];
    // Always 6 rows (42 cells) for consistent grid
    for (let i = 0; i < 42; i++) result.push(addDays(gridStart, i));
    return result;
  }, [year, month]);

  /* Map date → activities active on that date */
  const dateActivities = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of activities) {
      if (!a.current_start_date) continue;
      const start = new Date(a.current_start_date);
      const end = a.current_end_date ? new Date(a.current_end_date) : start;
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = toKey(cursor);
        const arr = m.get(key) ?? [];
        arr.push(a);
        m.set(key, arr);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return m;
  }, [activities]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }
  function goToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  }

  const monthLabel = new Date(year, month).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">←</button>
          <h2 className="min-w-[180px] text-center text-lg font-semibold">{monthLabel}</h2>
          <button onClick={nextMonth} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">→</button>
        </div>
        <button onClick={goToday} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">Today</button>
      </div>

      {/* Grid */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-1 py-2 text-center text-xs font-semibold uppercase text-gray-500">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((date) => {
            const key = toKey(date);
            const cd = calendarDays.get(key);
            const isCurrentMonth = date.getMonth() === month;
            const isToday = sameDay(date, today);
            const isOffDay = cd ? cd.is_workday === 0 : (date.getDay() === 0 || date.getDay() === 6);
            const acts = dateActivities.get(key) ?? [];

            return (
              <div
                key={key}
                className={`min-h-[80px] border-b border-r border-gray-100 p-1 dark:border-gray-800 sm:min-h-[100px]
                  ${!isCurrentMonth ? "bg-gray-50/50 dark:bg-gray-950/30" : ""}
                  ${isOffDay && isCurrentMonth ? "bg-gray-100/60 dark:bg-gray-900/60" : ""}
                  ${isToday ? "ring-2 ring-inset ring-blue-500" : ""}
                `}
              >
                {/* Day number + holiday */}
                <div className="flex items-start justify-between">
                  <span className={`text-xs font-medium ${isCurrentMonth ? "" : "text-gray-400 dark:text-gray-600"} ${isToday ? "rounded-full bg-blue-500 px-1.5 py-0.5 text-white" : ""}`}>
                    {date.getDate()}
                  </span>
                  {cd?.description && isCurrentMonth && (
                    <span className="max-w-[80%] truncate text-[10px] text-orange-500 dark:text-orange-400" title={cd.description}>
                      {cd.description}
                    </span>
                  )}
                </div>

                {/* Activity bars */}
                <div className="mt-0.5 space-y-0.5">
                  {acts.slice(0, 3).map((a) => {
                    const isStart = a.current_start_date === key;
                    return (
                      <button
                        key={a.job_schedule_activity_id}
                        onClick={() => setSelected(a)}
                        className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight text-white transition hover:opacity-80 ${barColor(a.status)}
                          ${isStart ? "rounded-l font-medium" : ""}
                        `}
                        title={a.description}
                      >
                        {isStart ? a.description : ""}
                      </button>
                    );
                  })}
                  {acts.length > 3 && (
                    <span className="block text-[10px] text-gray-500">+{acts.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded bg-blue-500/80" /> Released</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded bg-green-500/80" /> Approved</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded bg-gray-400/80" /> Completed</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded bg-gray-100 dark:bg-gray-900" /> Non-workday</span>
      </div>

      {/* Detail popup */}
      {selected && (
        <DetailPopup
          activity={selected}
          predecessors={predMap.get(selected.jsa_rid) ?? []}
          successors={succMap.get(selected.jsa_rid) ?? []}
          activityMap={activityMap}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
