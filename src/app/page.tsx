"use client";

import { useState } from "react";
import { JobSelector } from "@/components/JobSelector";
import { ListView } from "@/components/ListView";
import { useSchedule } from "@/hooks/useSchedule";
import type { Job } from "@/types";

export default function Home() {
  const [job, setJob] = useState<Job | null>(null);
  const { activities, dependencies, loading, error } = useSchedule(
    job?.schedule_rid ?? null
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

      <JobSelector onSelect={setJob} />

      {job && (
        <div className="mt-8">
          {loading && <p className="text-sm text-gray-500">Loading schedule…</p>}
          {error && <p className="text-sm text-red-500">Error: {error}</p>}
          {!loading && !error && (
            <ListView activities={activities} dependencies={dependencies} />
          )}
        </div>
      )}
    </main>
  );
}
