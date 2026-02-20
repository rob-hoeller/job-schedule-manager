"use client";

import { useMemo, useState, useEffect } from "react";
import type { Activity, Dependency } from "@/types";
import { ActivityRow } from "./ActivityRow";
import { statusClass } from "@/lib/utils";

interface Props {
  activities: Activity[];
  dependencies: Dependency[];
}

const COL_HEADERS: { label: string; className: string }[] = [
  { label: "Activity", className: "" },
  { label: "Start", className: "text-center md:hidden" },
  { label: "Trade Partner", className: "hidden sm:table-cell" },
  { label: "Status", className: "text-center" },
  { label: "Start", className: "hidden md:table-cell text-center" },
  { label: "End", className: "hidden md:table-cell text-center" },
  { label: "Days", className: "hidden lg:table-cell text-center" },
];

export function ListView({ activities, dependencies }: Props) {
  const [query, setQuery] = useState("");
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set(["Approved"]));
  const [showLate, setShowLate] = useState(false);
  const [today, setToday] = useState<string>("");

  // Get client-side current date
  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

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

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of activities) counts[a.status] = (counts[a.status] ?? 0) + 1;
    return counts;
  }, [activities]);

  const lateCount = useMemo(() => {
    if (!today) return 0;
    return activities.filter(
      (a) => a.status !== "Approved" && a.current_end_date !== null && a.current_end_date < today,
    ).length;
  }, [activities, today]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let result = activities;

    if (showLate && today) {
      result = result.filter(
        (a) => a.status !== "Approved" && a.current_end_date !== null && a.current_end_date < today,
      );
    } else if (hiddenStatuses.size > 0) {
      result = result.filter((a) => !hiddenStatuses.has(a.status));
    }

    if (q)
      result = result.filter(
        (a) =>
          a.description.toLowerCase().includes(q) ||
          (a.trade_partner_name?.toLowerCase().includes(q) ?? false),
      );

    return [...result].sort((a, b) =>
      (a.current_start_date ?? "").localeCompare(b.current_start_date ?? ""),
    );
  }, [activities, query, hiddenStatuses, showLate, today]);

  function toggleStatus(status: string) {
    if (showLate) setShowLate(false);
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function toggleLate() {
    setShowLate((prev) => !prev);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Debug: Show current date */}
      {today && (
        <div className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-xs text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
          Debug: Today = {today} | Late count = {lateCount}
        </div>
      )}
      
      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => toggleStatus(status)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${statusClass(status)} ${showLate ? "opacity-30" : hiddenStatuses.has(status) ? "opacity-30 line-through" : "hover:opacity-80"}`}
          >
            {status} <span className="font-normal">{count}</span>
          </button>
        ))}
        {lateCount > 0 && (
          <button
            onClick={toggleLate}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ${showLate ? "ring-2 ring-red-500/40 hover:opacity-80" : "opacity-30 hover:opacity-60"}`}
          >
            Late <span className="font-normal">{lateCount}</span>
          </button>
        )}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Filter by activity or trade partner…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900"
      />

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              {COL_HEADERS.map((h, i) => (
                <th key={`${h.label}-${i}`} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 ${h.className}`}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <ActivityRow
                key={a.job_schedule_activity_id}
                activity={a}
                predecessors={predMap.get(a.jsa_rid) ?? []}
                successors={succMap.get(a.jsa_rid) ?? []}
                activityMap={activityMap}
              />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">No activities match your filter.</p>
        )}
      </div>
    </div>
  );
}
