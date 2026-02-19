"use client";

import { useState } from "react";
import { useJobs } from "@/hooks/useJobs";
import type { Job } from "@/types";

export function JobSelector({ onSelect }: { onSelect: (job: Job | null) => void }) {
  const { jobs, loading, error } = useJobs();
  const [selectedId, setSelectedId] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedId(id);
    onSelect(jobs.find((j) => j.job_id === id) ?? null);
  }

  if (error) return <p className="text-sm text-red-500">Error: {error}</p>;

  return (
    <select
      value={selectedId}
      onChange={handleChange}
      disabled={loading}
      className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
    >
      <option value="">{loading ? "Loading jobs…" : "Select a job"}</option>
      {jobs.map((j) => (
        <option key={j.job_id} value={j.job_id}>
          {j.community_name} — Lot {j.lot_number}
        </option>
      ))}
    </select>
  );
}
