"use client";

import { useState } from "react";
import toast from "react-hot-toast";

import type { StagedChange } from "@/hooks/useStaging";
import { formatDate } from "@/lib/utils";

interface Props {
  directCount: number;
  cascadedCount: number;
  changesByActivity: Map<number, Map<string, StagedChange>>;
  activityNames: Map<number, string>;
  onDiscardAll: () => Promise<void>;
  onPublish: (note: string) => Promise<unknown>;
  onPublished?: () => void;
  loading: boolean;
}

export function StagingToolbar({
  directCount,
  cascadedCount,
  changesByActivity,
  activityNames,
  onDiscardAll,
  onPublish,
  onPublished,
  loading,
}: Props) {
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const total = directCount + cascadedCount;

  // Check if Settlement date is affected
  const settlementImpact = (() => {
    for (const [jsaRid, fields] of changesByActivity) {
      const name = activityNames.get(jsaRid);
      if (name !== "Settlement") continue;
      const endChange = fields.get("end_date");
      if (!endChange || !endChange.original_value || !endChange.staged_value) continue;
      const orig = new Date(endChange.original_value + "T12:00:00");
      const staged = new Date(endChange.staged_value + "T12:00:00");
      const diffMs = staged.getTime() - orig.getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return null;
      return {
        originalDate: endChange.original_value,
        stagedDate: endChange.staged_value,
        diffDays,
      };
    }
    return null;
  })();

  function fieldLabel(field: string) {
    if (field === "start_date") return "Start date";
    if (field === "end_date") return "End date";
    if (field === "duration") return "Duration";
    if (field === "status") return "Status";
    return field;
  }

  function formatValue(field: string, value: string | null) {
    if (!value) return "—";
    if (field === "duration") return `${value} days`;
    if (field.endsWith("_date")) return formatDate(value);
    return value;
  }

  async function handleDiscard() {
    setDiscarding(true);
    try {
      await onDiscardAll();
      toast.success("All staged changes discarded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDiscarding(false);
    }
  }

  async function handlePublish() {
    if (!publishNote.trim()) return;
    setPublishing(true);
    try {
      await onPublish(publishNote);
      toast.success(`Published ${total} changes`);
      setShowPublishModal(false);
      setPublishNote("");
      onPublished?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="text-sm text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <span className="text-base">⚡</span>
            <span className="font-medium">{total} staged changes</span>
            <span className="text-amber-600 dark:text-amber-400">
              ({directCount} direct, {cascadedCount} cascaded)
            </span>
          </div>
          {settlementImpact && (
            <div className={`ml-6 mt-0.5 text-xs font-medium ${settlementImpact.diffDays > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
              Settlement {settlementImpact.diffDays > 0 ? "pushed" : "pulled"} {Math.abs(settlementImpact.diffDays)} day{Math.abs(settlementImpact.diffDays) !== 1 ? "s" : ""}{" "}
              ({formatDate(settlementImpact.originalDate)} → {formatDate(settlementImpact.stagedDate)})
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDiscard}
            disabled={loading || discarding}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {discarding ? "Discarding…" : "Discard All"}
          </button>
          <button
            onClick={() => setShowPublishModal(true)}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Review & Publish →
          </button>
        </div>
      </div>

      {/* Publish Review Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowPublishModal(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 text-lg font-semibold">📋 Review Staged Changes</h2>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              {total} total ({directCount} direct edits, {cascadedCount} cascaded)
            </p>

            <div className="mb-4 max-h-64 space-y-3 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm dark:border-gray-800 dark:bg-gray-950/30">
              {[...changesByActivity.entries()].map(([jsaRid, fields]) => (
                <div key={jsaRid} className="space-y-1 border-b border-gray-200 pb-3 last:border-b-0 last:pb-0 dark:border-gray-800">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {activityNames.get(jsaRid) ?? `Activity ${jsaRid}`}
                  </div>
                  {[...fields.values()].map((change) => (
                    <div key={`${jsaRid}-${change.field_name}`} className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {fieldLabel(change.field_name)}:
                      </span>
                      <span className="rounded bg-white px-2 py-0.5 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                        {formatValue(change.field_name, change.original_value)}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="rounded bg-white px-2 py-0.5 text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                        {formatValue(change.field_name, change.staged_value)}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          change.is_direct_edit
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                        }`}
                      >
                        {change.is_direct_edit ? "Direct" : "Cascaded"}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              {changesByActivity.size === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No staged changes found.</p>
              )}
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Publish Note <span className="text-red-500">*</span>
              </label>
              <textarea
                value={publishNote}
                onChange={(e) => setPublishNote(e.target.value)}
                rows={3}
                placeholder="Explain the reason for these changes..."
                autoFocus
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-400"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowPublishModal(false)}
                className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !publishNote.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {publishing ? "Publishing…" : "Publish Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
