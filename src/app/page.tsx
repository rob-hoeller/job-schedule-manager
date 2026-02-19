"use client";

import { useState } from "react";
import { JobSelector } from "@/components/JobSelector";
import type { Job } from "@/types";

export default function Home() {
  const [job, setJob] = useState<Job | null>(null);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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
        <div className="mt-8 flex gap-3">
          {["List", "Calendar", "Gantt"].map((view) => (
            <span
              key={view}
              className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              {view}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}
