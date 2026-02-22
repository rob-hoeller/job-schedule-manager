"use client";

import { useMemo, useState } from "react";
import { JobSelector } from "@/components/JobSelector";
import { JobDetails } from "@/components/JobDetails";
import { ListView } from "@/components/ListView";
import { CalendarView } from "@/components/CalendarView";
import { GanttView } from "@/components/GanttView";
import { ViewTabs } from "@/components/ViewTabs";
import { NavBar } from "@/components/NavBar";
import { useSchedule } from "@/hooks/useSchedule";
import { useCalendarDays } from "@/hooks/useCalendarDays";
import type { Job, ViewMode } from "@/types";

export default function Home() {
  const [job, setJob] = useState<Job | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const { activities, dependencies, loading, error } = useSchedule(
    job?.schedule_rid ?? null,
  );
  const { days: calendarDays } = useCalendarDays(2026);

  const settlement = useMemo(
    () => activities.find((a) => a.description === "Settlement") ?? null,
    [activities],
  );

  return (
    <main className="mx-auto flex h-dvh max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
      <header className="mb-3 shrink-0">
        <NavBar />
      </header>

      <div className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <JobSelector onSelect={setJob} />
        {job && <ViewTabs active={view} onChange={setView} />}
      </div>

      {job && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="shrink-0">
            <JobDetails job={job} settlement={settlement} />
          </div>

          {loading && <p className="text-sm text-gray-500">Loading schedule…</p>}
          {error && <p className="text-sm text-red-500">Error: {error}</p>}
          {!loading && !error && (
            <div className="min-h-0 flex-1">
              {view === "list" && (
                <ListView activities={activities} dependencies={dependencies} />
              )}
              {view === "calendar" && (
                <CalendarView
                  activities={activities}
                  dependencies={dependencies}
                  calendarDays={calendarDays}
                />
              )}
              {view === "gantt" && (
                <GanttView
                  activities={activities}
                  dependencies={dependencies}
                  calendarDays={calendarDays}
                />
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
