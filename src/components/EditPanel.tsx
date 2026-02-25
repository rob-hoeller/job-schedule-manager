"use client";

import { useState } from "react";
import type { Activity } from "@/types";
import toast from "react-hot-toast";

type Tab = "move_start" | "change_duration" | "history";

export type EditPanelMode = "move_start" | "change_duration" | "status";

interface Props {
  activity: Activity;
  onClose: () => void;
  onStageEdit: (jsaRid: number, moveType: "move_start" | "change_duration", value: string | number) => Promise<void>;
  onStatusUpdate: (jsaRid: number, status: string, note: string) => Promise<unknown>;
  onActivityUpdated?: () => void;
  stagedFields?: Map<string, { original_value: string | null; staged_value: string }>;
  initialMode?: EditPanelMode;
}

export function EditPanel({ activity, onClose, onStageEdit, onStatusUpdate, onActivityUpdated, stagedFields, initialMode }: Props) {
  const [tab, setTab] = useState<Tab>(initialMode === "change_duration" ? "change_duration" : "move_start");
  const [newStartDate, setNewStartDate] = useState(activity.current_start_date ?? "");
  const [newDuration, setNewDuration] = useState(activity.current_duration ?? 1);
  const [saving, setSaving] = useState(false);

  // Status
  const [showStatusModal, setShowStatusModal] = useState(initialMode === "status");
  const [pendingStatus, setPendingStatus] = useState<string>(
    initialMode === "status" ? (activity.status === "Completed" ? "Approved" : "Completed") : ""
  );
  const [statusNote, setStatusNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  async function handleStageMove() {
    setSaving(true);
    try {
      await onStageEdit(activity.jsa_rid, "move_start", newStartDate);
      toast.success("Move staged — see cascade in views");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStageDuration() {
    setSaving(true);
    try {
      await onStageEdit(activity.jsa_rid, "change_duration", newDuration);
      toast.success("Duration change staged — see cascade in views");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusConfirm() {
    setSavingStatus(true);
    try {
      await onStatusUpdate(activity.jsa_rid, pendingStatus, statusNote || `Status changed to ${pendingStatus}`);
      toast.success(`Status updated to ${pendingStatus}`);
      setShowStatusModal(false);
      onActivityUpdated?.();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingStatus(false);
    }
  }

  const hasStaged = stagedFields && stagedFields.size > 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[10vh] sm:items-center sm:pt-0" onClick={onClose}>
        <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">{activity.description}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {activity.trade_partner_name ?? "No trade partner"}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          {/* Current values */}
          <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800/50">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Start</span>
                <p className="font-medium">{activity.current_start_date ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">End</span>
                <p className="font-medium">{activity.current_end_date ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Duration</span>
                <p className="font-medium">{activity.current_duration ?? "—"} days</p>
              </div>
            </div>
            {hasStaged && (
              <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                ⚡ This activity has staged changes
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {(["move_start", "change_duration"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  tab === t
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
              >
                {t === "move_start" ? "Move Start" : "Change Duration"}
              </button>
            ))}
          </div>

          {/* Move Start Tab */}
          {tab === "move_start" && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">New Start Date</label>
                <input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-400"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Duration ({activity.current_duration} days) will be preserved. End date adjusts automatically.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button
                  onClick={handleStageMove}
                  disabled={saving || !newStartDate || newStartDate === activity.current_start_date}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-700"
                >
                  {saving ? "Staging…" : "Stage Move →"}
                </button>
              </div>
            </div>
          )}

          {/* Change Duration Tab */}
          {tab === "change_duration" && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">New Duration (workdays)</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setNewDuration(Math.max(1, newDuration - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={newDuration}
                    onChange={(e) => setNewDuration(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-400"
                  />
                  <button
                    onClick={() => setNewDuration(newDuration + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-lg hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Start date ({activity.current_start_date}) stays fixed. End date adjusts automatically.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                  Cancel
                </button>
                <button
                  onClick={handleStageDuration}
                  disabled={saving || newDuration === activity.current_duration}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-700"
                >
                  {saving ? "Staging…" : "Stage Move →"}
                </button>
              </div>
            </div>
          )}

          {/* Status Section */}
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-gray-500 dark:text-gray-400">Status: </span>
                <span className="font-medium">{activity.status}</span>
              </div>
              {activity.status !== "Approved" && (
                <div className="flex gap-2">
                  {activity.status !== "Completed" && (
                    <button
                      onClick={() => { setPendingStatus("Completed"); setShowStatusModal(true); }}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      Mark Completed
                    </button>
                  )}
                  <button
                    onClick={() => { setPendingStatus("Approved"); setShowStatusModal(true); }}
                    className="rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
                  >
                    Mark Approved
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Note Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowStatusModal(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold">Update Status: {activity.description}</h3>
            <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
              New Status: <span className="font-medium">{pendingStatus}</span>
            </p>
            <div className="mb-3">
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">Note (optional)</label>
              <textarea
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                rows={2}
                placeholder="Reason for status change..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-400"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowStatusModal(false)} className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                Cancel
              </button>
              <button
                onClick={handleStatusConfirm}
                disabled={savingStatus}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {savingStatus ? "Updating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
