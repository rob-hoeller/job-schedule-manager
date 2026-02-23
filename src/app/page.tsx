"use client";

import { useCallback, useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import { JobSelector } from "@/components/JobSelector";
import { JobDetails } from "@/components/JobDetails";
import { ListView } from "@/components/ListView";
import { CalendarView } from "@/components/CalendarView";
import { GanttView } from "@/components/GanttView";
import { ViewTabs } from "@/components/ViewTabs";
import { NavBar } from "@/components/NavBar";
import { EditPanel } from "@/components/EditPanel";
import { StagingToolbar } from "@/components/StagingToolbar";
import { useSchedule } from "@/hooks/useSchedule";
import { useCalendarDays } from "@/hooks/useCalendarDays";
import { useStaging } from "@/hooks/useStaging";
import type { Activity, Job, ViewMode } from "@/types";

export default function Home() {
  const [job, setJob] = useState<Job | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const { activities, dependencies, loading, error, refresh: refreshSchedule } = useSchedule(
    job?.schedule_rid ?? null,
  );
  const { days: calendarDays } = useCalendarDays(2026);
  const staging = useStaging(job?.schedule_rid ?? null);

  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const settlement = useMemo(
    () => activities.find((a) => a.description === "Settlement") ?? null,
    [activities],
  );

  const handleActivityClick = useCallback((activity: Activity) => {
    setEditingActivity(activity);
  }, []);

  const handlePublished = useCallback(() => {
    refreshSchedule();
  }, [refreshSchedule]);

  const handleActivityUpdated = useCallback(() => {
    refreshSchedule();
  }, [refreshSchedule]);

  return (
    <main className="mx-auto flex h-dvh max-w-6xl flex-col px-4 py-4 sm:px-6 lg:px-8">
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />

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

          {/* Staging toolbar */}
          {staging.isActive && (
            <div className="shrink-0">
              <StagingToolbar
                directCount={staging.directCount}
                cascadedCount={staging.cascadedCount}
                onDiscardAll={staging.discardAll}
                onPublish={staging.publish}
                onPublished={handlePublished}
                loading={staging.loading}
              />
            </div>
          )}

          {loading && <p className="text-sm text-gray-500">Loading schedule…</p>}
          {error && <p className="text-sm text-red-500">Error: {error}</p>}
          {!loading && !error && (
            <div className="min-h-0 flex-1">
              {view === "list" && (
                <ListView
                  activities={activities}
                  dependencies={dependencies}
                  onActivityClick={handleActivityClick}
                  stagedChanges={staging.byActivity}
                />
              )}
              {view === "calendar" && (
                <CalendarView
                  activities={activities}
                  dependencies={dependencies}
                  calendarDays={calendarDays}
                  onActivityClick={handleActivityClick}
                  stagedChanges={staging.byActivity}
                />
              )}
              {view === "gantt" && (
                <GanttView
                  activities={activities}
                  dependencies={dependencies}
                  calendarDays={calendarDays}
                  onActivityClick={handleActivityClick}
                  stagedChanges={staging.byActivity}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Panel */}
      {editingActivity && (
        <EditPanel
          activity={editingActivity}
          onClose={() => setEditingActivity(null)}
          onStageEdit={staging.stageEdit}
          onStatusUpdate={staging.updateStatus}
          onActivityUpdated={handleActivityUpdated}
          stagedFields={staging.byActivity.get(editingActivity.jsa_rid)}
        />
      )}
    </main>
  );
}
