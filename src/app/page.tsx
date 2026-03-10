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
import type { EditPanelMode } from "@/components/EditPanel";
import { StagingToolbar } from "@/components/StagingToolbar";
import { ScheduleHistoryModal } from "@/components/ScheduleHistoryModal";
import { ChatPanel } from "@/components/ChatPanel";
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
  const [editMode, setEditMode] = useState<EditPanelMode | undefined>();
  const [showScheduleHistory, setShowScheduleHistory] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // Merge staged changes into activities for visual preview
  const effectiveActivities = useMemo(() => {
    if (!staging.isActive) return activities;
    return activities.map((a) => {
      const staged = staging.byActivity.get(a.jsa_rid);
      if (!staged) return a;
      const eff = { ...a };
      const startChange = staged.get("start_date");
      const endChange = staged.get("end_date");
      const durChange = staged.get("duration");
      if (startChange) eff.current_start_date = startChange.staged_value;
      if (endChange) eff.current_end_date = endChange.staged_value;
      if (durChange) eff.current_duration = parseInt(durChange.staged_value);
      return eff;
    });
  }, [activities, staging.isActive, staging.byActivity]);

  const settlement = useMemo(
    () => activities.find((a) => a.description === "Settlement") ?? null,
    [activities],
  );

  const activityNames = useMemo(
    () => new Map(activities.map((a) => [a.jsa_rid, a.description])),
    [activities],
  );

  const handleActivityClick = useCallback((activity: Activity, mode?: EditPanelMode) => {
    setEditingActivity(activity);
    setEditMode(mode);
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
        {job && (
          <div className="flex items-center justify-between gap-2">
            <ViewTabs active={view} onChange={setView} />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowScheduleHistory(true)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Job History"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">History</span>
              </button>
              <button
                onClick={() => setShowChat(true)}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
                title="AI Schedule Assistant"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM10 7a3 3 0 100 6 3 3 0 000-6zm-6.25 3a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5H3a.75.75 0 01.75.75zm13.5 0a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5H17a.75.75 0 01.75.75zm-11.14 3.89a.75.75 0 010 1.06l-1.06 1.06a.75.75 0 01-1.06-1.06l1.06-1.06a.75.75 0 011.06 0zm7.78 0a.75.75 0 011.06 0l1.06 1.06a.75.75 0 11-1.06 1.061l-1.06-1.06a.75.75 0 010-1.06zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15z" />
                </svg>
                <span className="hidden sm:inline">AI</span>
              </button>
            </div>
          </div>
        )}
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
                changesByActivity={staging.byActivity}
                activityNames={activityNames}
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
                  activities={effectiveActivities}
                  dependencies={dependencies}
                  onActivityClick={handleActivityClick}
                  stagedChanges={staging.byActivity}
                />
              )}
              {view === "calendar" && (
                <CalendarView
                  activities={effectiveActivities}
                  dependencies={dependencies}
                  calendarDays={calendarDays}
                  onActivityClick={handleActivityClick}
                  stagedChanges={staging.byActivity}
                />
              )}
              {view === "gantt" && (
                <GanttView
                  activities={effectiveActivities}
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
          initialMode={editMode}
        />
      )}

      {job && (
        <ScheduleHistoryModal
          scheduleRid={job.schedule_rid}
          open={showScheduleHistory}
          onClose={() => setShowScheduleHistory(false)}
        />
      )}

      {job && (
        <ChatPanel
          open={showChat}
          onClose={() => setShowChat(false)}
          scheduleRid={job.schedule_rid}
          jobLabel={`${job.community_name} Lot ${job.lot_number}`}
          selectedJsaRid={editingActivity?.jsa_rid ?? null}
          onStageEdit={staging.stageEdit}
          onStatusUpdate={staging.updateStatus}
          onRefresh={refreshSchedule}
        />
      )}
    </main>
  );
}
