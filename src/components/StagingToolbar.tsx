"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface Props {
  directCount: number;
  cascadedCount: number;
  onDiscardAll: () => Promise<void>;
  onPublish: (note: string) => Promise<unknown>;
  onPublished?: () => void;
  loading: boolean;
}

export function StagingToolbar({ directCount, cascadedCount, onDiscardAll, onPublish, onPublished, loading }: Props) {
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const total = directCount + cascadedCount;

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
        <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
          <span className="text-base">⚡</span>
          <span className="font-medium">{total} staged changes</span>
          <span className="text-amber-600 dark:text-amber-400">
            ({directCount} direct, {cascadedCount} cascaded)
          </span>
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
