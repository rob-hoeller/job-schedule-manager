"use client";

import { useMemo, useState } from "react";
import type { Activity, Dependency, SortField, SortDir } from "@/types";
import { ActivityRow } from "./ActivityRow";
import { statusClass } from "@/lib/utils";

interface Props {
  activities: Activity[];
  dependencies: Dependency[];
}

function sortActivities(activities: Activity[], field: SortField, dir: SortDir) {
  return [...activities].sort((a, b) => {
    const av = a[field] ?? "";
    const bv = b[field] ?? "";
    const cmp = String(av).localeCompare(String(bv));
    return dir === "asc" ? cmp : -cmp;
  });
}

const SORT_OPTIONS: { label: string; field: SortField }[] = [
  { label: "Start Date", field: "current_start_date" },
  { label: "Description", field: "description" },
  { label: "Trade Partner", field: "trade_partner_name" },
  { label: "Status", field: "status" },
];

const COL_HEADERS: { label: string; className: string }[] = [
  { label: "Activity", className: "" },
  { label: "Start", className: "md:hidden" },
  { label: "Trade Partner", className: "hidden sm:table-cell" },
  { label: "Status", className: "text-center" },
  { label: "Start", className: "hidden md:table-cell" },
  { label: "End", className: "hidden md:table-cell" },
  { label: "Days", className: "hidden lg:table-cell text-center" },
];

export function ListView({ activities, dependencies }: Props) {
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("current_start_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set(["Approved"]));

  const activityMap = useMemo(
    () => new Map(activities.map((a) => [a.jsa_rid, a])),
    [activities]
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

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    let result = activities;
    if (hiddenStatuses.size > 0)
      result = result.filter((a) => !hiddenStatuses.has(a.status));
    if (q)
      result = result.filter(
        (a) =>
          a.description.toLowerCase().includes(q) ||
          (a.trade_partner_name?.toLowerCase().includes(q) ?? false)
      );
    return sortActivities(result, sortField, sortDir);
  }, [activities, query, sortField, sortDir, hiddenStatuses]);

  function toggleStatus(status: string) {
    setHiddenStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary + status filter */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{activities.length} activities</span>
        <span className="text-gray-400">—</span>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => toggleStatus(status)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${statusClass(status)} ${hiddenStatuses.has(status) ? "opacity-30 line-through" : "hover:opacity-80"}`}
          >
            {status} <span className="font-normal">{count}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          placeholder="Filter by activity or trade partner…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900"
        />
        <select
          value={sortField}
          onChange={(e) => toggleSort(e.target.value as SortField)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.field} value={o.field}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          title={`Sort ${sortDir === "asc" ? "descending" : "ascending"}`}
        >
          {sortDir === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-gray-200 dark:border-gray-800" style={{ maxHeight: "calc(100vh - 340px)" }}>
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
            <tr>
              {COL_HEADERS.map((h) => (
                <th key={h.label} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 ${h.className}`}>
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
