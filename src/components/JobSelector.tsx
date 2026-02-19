"use client";

import { useState } from "react";
import { useJobs } from "@/hooks/useJobs";
import { formatDate } from "@/lib/utils";
import type { Job } from "@/types";

export function JobSelector({
  onSelect,
}: {
  onSelect: (job: Job | null) => void;
}) {
  const { jobs, loading, error } = useJobs();
  const [selectedId, setSelectedId] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedId(id);
    onSelect(jobs.find((j) => j.job_id === id) ?? null);
  }

  if (error) return <p className="text-red-500 text-sm">Error: {error}</p>;

  const selected = jobs.find((j) => j.job_id === selectedId);

  return (
    <div className="space-y-3">
      <select
        value={selectedId}
        onChange={handleChange}
        disabled={loading}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900"
      >
        <option value="">
          {loading ? "Loading jobs…" : "Select a job"}
        </option>
        {jobs.map((j) => (
          <option key={j.job_id} value={j.job_id}>
            {j.community_name} — Lot {j.lot_number}
          </option>
        ))}
      </select>

      {selected && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Detail label="Community" value={selected.community_name} />
            <Detail label="Lot" value={selected.lot_number} />
            <Detail label="Plan" value={selected.plan_name ?? "—"} />
            <Detail label="Status" value={selected.status} />
            <Detail label="Start" value={formatDate(selected.start_date)} />
            <Detail label="Est. End" value={formatDate(selected.estimated_end_date)} />
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500 dark:text-gray-400">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
