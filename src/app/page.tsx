"use client";

import { useMemo, useState } from "react";
import { JobSelector } from "@/components/JobSelector";
import { JobDetails } from "@/components/JobDetails";
import { ListView } from "@/components/ListView";
import { CalendarView } from "@/components/CalendarView";
import { ViewTabs } from "@/components/ViewTabs";
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
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Job Schedule Manager
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Select a job to view its schedule
        </p>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <JobSelector onSelect={setJob} />
        {job && <ViewTabs active={view} onChange={setView} />}
      </div>

      {job && (
        <div className="mt-4 space-y-6">
          <JobDetails job={job} settlement={settlement} />

          {loading && <p className="text-sm text-gray-500">Loading schedule…</p>}
          {error && <p className="text-sm text-red-500">Error: {error}</p>}
          {!loading && !error && view === "list" && (
            <ListView activities={activities} dependencies={dependencies} />
          )}
          {!loading && !error && view === "calendar" && (
            <CalendarView
              activities={activities}
              dependencies={dependencies}
              calendarDays={calendarDays}
            />
          )}
        </div>
      )}
    </main>
  );
}
