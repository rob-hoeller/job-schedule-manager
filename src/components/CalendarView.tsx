"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Activity, Dependency, CalendarDay } from "@/types";
import { ActivityDetailPopup } from "./ActivityDetailPopup";

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

/** Calculate which day number this date is within an activity span (1-based) */
function activityDayNum(activity: Activity, dateKey: string): number {
  if (!activity.current_start_date) return 1;
  const start = new Date(activity.current_start_date);
  const current = new Date(dateKey);
  return Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const VISIBLE_BARS = 3;

interface Props {
  activities: Activity[];
  dependencies: Dependency[];
  calendarDays: Map<string, CalendarDay>;
}

/* ── detail popup ── */
/* Detail popup is now shared via ActivityDetailPopup */

/* ── overflow popup ("+N more") ── */
function OverflowPopup({
  date,
  activities: acts,
  onSelect,
  onClose,
}: {
  date: Date;
  activities: Activity[];
  onSelect: (a: Activity) => void;
  onClose: () => void;
}) {
  const dateKey = toKey(date);
  const label = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 max-h-[60vh] w-full max-w-sm overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{label} — {acts.length} activities</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>
        <div className="space-y-1">
          {acts.map((a) => {
            const dayNum = activityDayNum(a, dateKey);
            const dayTag = dayNum > 1 ? ` - Day ${dayNum}` : "";
            return (
              <button
                key={a.job_schedule_activity_id}
                onClick={() => { onClose(); onSelect(a); }}
                className={`block w-full truncate rounded px-2 py-1.5 text-left text-xs text-white transition hover:opacity-80 ${barColor(a.status)}`}
              >
                {a.description}{dayTag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── mobile scrollable day list ── */
function MobileView({
  calendarDays,
  dateActivities,
  activities,
  onSelectActivity,
}: {
  calendarDays: Map<string, CalendarDay>;
  dateActivities: Map<string, Activity[]>;
  activities: Activity[];
  onSelectActivity: (a: Activity) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const todayRef = useRef<HTMLDivElement>(null);

  /* Build day list from first activity through last activity date */
  const days = useMemo(() => {
    let firstDate = new Date(today);
    let lastDate = new Date(today);
    for (const a of activities) {
      if (a.current_start_date) {
        const d = new Date(a.current_start_date);
        if (d < firstDate) firstDate = d;
      }
      if (a.current_end_date) {
        const d = new Date(a.current_end_date);
        if (d > lastDate) lastDate = d;
      }
    }
    const result: Date[] = [];
    const cursor = new Date(firstDate);
    while (cursor <= lastDate) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }, [activities, today]);

  /* Only render days that have activities (plus today always) */
  const visibleDays = useMemo(() => {
    return days.filter((d) => {
      if (sameDay(d, today)) return true;
      return (dateActivities.get(toKey(d))?.length ?? 0) > 0;
    });
  }, [days, dateActivities, today]);

  /* Auto-scroll to today on mount */
  useEffect(() => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ block: "start" });
    }
  }, []);

  return (
    <div className="overflow-y-auto space-y-2" style={{ maxHeight: "calc(100vh - 340px)" }}>
      {visibleDays.map((date) => {
        const key = toKey(date);
        const cd = calendarDays.get(key);
        const isToday = sameDay(date, today);
        const isOffDay = cd ? cd.is_workday === 0 : (date.getDay() === 0 || date.getDay() === 6);
        const acts = dateActivities.get(key) ?? [];
        const dayLabel = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

        return (
          <div
            key={key}
            ref={isToday ? todayRef : undefined}
            className={`rounded-lg border p-3 ${isToday ? "border-blue-500 ring-2 ring-blue-500/20" : "border-gray-200 dark:border-gray-800"} ${isOffDay ? "bg-gray-50 dark:bg-gray-900/60" : "bg-white dark:bg-gray-950"}`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className={`text-sm font-semibold ${isToday ? "text-blue-600 dark:text-blue-400" : ""}`}>
                {isToday ? `Today — ${dayLabel}` : dayLabel}
              </span>
              {cd?.description && (
                <span className="text-xs text-orange-500 dark:text-orange-400">{cd.description}</span>
              )}
            </div>
            {acts.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No activities</p>
            ) : (
              <div className="space-y-1">
                {acts.map((a) => {
                  const dayNum = activityDayNum(a, key);
                  const dayTag = dayNum > 1 ? ` - Day ${dayNum}` : "";
                  return (
                    <button
                      key={a.job_schedule_activity_id}
                      onClick={() => onSelectActivity(a)}
                      className={`block w-full truncate rounded px-2 py-1.5 text-left text-xs text-white transition hover:opacity-80 ${barColor(a.status)}`}
                    >
                      {a.description}{dayTag}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── main component ── */
export function CalendarView({ activities, dependencies, calendarDays }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<Activity | null>(null);
  const [overflowDay, setOverflowDay] = useState<Date | null>(null);

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
    const startDow = first.getDay();
    const gridStart = addDays(first, -startDow);
    const result: Date[] = [];
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
      {/* ── Mobile: scrollable day list ── */}
      <div className="sm:hidden">
        <MobileView
          calendarDays={calendarDays}
          dateActivities={dateActivities}
          activities={activities}
          onSelectActivity={setSelected}
        />
      </div>

      {/* ── Desktop: Full month grid ── */}
      <div className="hidden sm:block">
        {/* Nav */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">←</button>
            <h2 className="min-w-[180px] text-center text-lg font-semibold">{monthLabel}</h2>
            <button onClick={nextMonth} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">→</button>
          </div>
          <button onClick={goToday} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">Today</button>
        </div>

        {/* Grid */}
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-1 py-2 text-center text-xs font-semibold uppercase text-gray-500">{d}</div>
            ))}
          </div>

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
                  className={`min-h-[100px] border-b border-r border-gray-100 p-1 dark:border-gray-800
                    ${!isCurrentMonth ? "bg-gray-50/50 dark:bg-gray-950/30" : ""}
                    ${isOffDay && isCurrentMonth ? "bg-gray-100/60 dark:bg-gray-900/60" : ""}
                    ${isToday ? "ring-2 ring-inset ring-blue-500" : ""}
                  `}
                >
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

                  <div className="mt-0.5 space-y-0.5">
                    {acts.slice(0, VISIBLE_BARS).map((a) => {
                      const dayNum = activityDayNum(a, key);
                      const dayTag = dayNum > 1 ? ` - Day ${dayNum}` : "";
                      return (
                        <button
                          key={a.job_schedule_activity_id}
                          onClick={() => setSelected(a)}
                          className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight text-white transition hover:opacity-80 ${barColor(a.status)}`}
                          title={`${a.description}${dayTag}`}
                        >
                          {a.description}{dayTag}
                        </button>
                      );
                    })}
                    {acts.length > VISIBLE_BARS && (
                      <button
                        onClick={() => setOverflowDay(date)}
                        className="block w-full text-left text-[10px] font-medium text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        +{acts.length - VISIBLE_BARS} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded bg-blue-500/80" /> Released</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded bg-green-500/80" /> Approved</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded bg-gray-400/80" /> Completed</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded bg-gray-100 dark:bg-gray-900" /> Non-workday</span>
      </div>

      {/* Overflow popup */}
      {overflowDay && (
        <OverflowPopup
          date={overflowDay}
          activities={dateActivities.get(toKey(overflowDay)) ?? []}
          onSelect={setSelected}
          onClose={() => setOverflowDay(null)}
        />
      )}

      {/* Detail popup */}
      {selected && (
        <ActivityDetailPopup
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
