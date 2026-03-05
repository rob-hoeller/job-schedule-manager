"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";

interface ChangeRecord {
  change_record_rid: string;
  jsa_rid: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  is_direct_edit: boolean;
  activity_description: string;
}

interface SettlementImpact {
  oldDate: string;
  newDate: string;
  diffDays: number;
}

interface HistoryEvent {
  publish_event_rid: string;
  published_at: string;
  publish_note: string | null;
  move_types: string[] | string | null;
  change_count: number;
  direct_edit_count: number;
  cascaded_count: number;
  user_display_name: string;
  settlement_impact: SettlementImpact | null;
  direct_edits: ChangeRecord[];
  cascaded_changes: ChangeRecord[];
}

interface Props {
  scheduleRid: number;
  open: boolean;
  onClose: () => void;
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fieldLabel(field: string) {
  if (field === "start_date") return "Start";
  if (field === "end_date") return "End";
  if (field === "duration") return "Duration";
  if (field === "status") return "Status";
  return field;
}

function fmtVal(field: string, value: string | null) {
  if (!value) return "—";
  if (field === "duration") return `${value}d`;
  if (field.endsWith("_date")) return formatDate(value);
  return value;
}

function ChangeRow({ r }: { r: ChangeRecord }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <span className="font-medium text-gray-800 dark:text-gray-200">{r.activity_description}</span>
      <span className="text-gray-400">·</span>
      <span className="text-gray-500 dark:text-gray-400">{fieldLabel(r.field_name)}</span>
      <span className="text-gray-400">{fmtVal(r.field_name, r.old_value)} → {fmtVal(r.field_name, r.new_value)}</span>
    </div>
  );
}

export function ScheduleHistoryModal({ scheduleRid, open, onClose }: Props) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setEvents([]);
    setExpanded(new Set());
    fetch(`/api/history/job?schedule_rid=${scheduleRid}`)
      .then((res) => res.json())
      .then((data) => {
        if (active) setEvents(data.events ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [open, scheduleRid]);

  function toggle(rid: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rid)) next.delete(rid);
      else next.add(rid);
      return next;
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 p-5 pb-4 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold">Job History</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">All published changes to this schedule</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 pt-4">
          {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading history…</p>}
          {!loading && events.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">No publish history recorded.</p>
          )}

          <div className="space-y-3">
            {events.map((event) => {
              const isOpen = expanded.has(event.publish_event_rid);
              const si = event.settlement_impact;

              return (
                <div key={event.publish_event_rid} className="rounded-lg border border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-950/30">
                  {/* Event header — always visible */}
                  <button
                    onClick={() => toggle(event.publish_event_rid)}
                    className="flex w-full items-start justify-between p-4 text-left"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Who & when */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {event.user_display_name}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatTimestamp(event.published_at)}
                        </span>
                      </div>

                      {/* Direct edits summary */}
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {event.direct_edits.length > 0 ? (
                          event.direct_edits.map((r, i) => (
                            <span key={r.change_record_rid}>
                              {i > 0 && ", "}
                              <span className="font-medium text-gray-700 dark:text-gray-300">{r.activity_description}</span>
                              {" "}{fieldLabel(r.field_name)} {fmtVal(r.field_name, r.old_value)} → {fmtVal(r.field_name, r.new_value)}
                            </span>
                          ))
                        ) : (
                          <span>Status update</span>
                        )}
                      </div>

                      {/* Counts + settlement impact */}
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-gray-400 dark:text-gray-500">
                          {event.change_count} change{event.change_count !== 1 ? "s" : ""}
                          {event.cascaded_count > 0 && (
                            <> ({event.cascaded_count} cascaded)</>
                          )}
                        </span>
                        {si && (
                          <span className={`font-medium ${si.diffDays > 0 ? "text-red-500 dark:text-red-400" : "text-green-500 dark:text-green-400"}`}>
                            Settlement {si.diffDays > 0 ? "+" : ""}{si.diffDays}d ({formatDate(si.oldDate)} → {formatDate(si.newDate)})
                          </span>
                        )}
                      </div>

                      {/* Publish note */}
                      {event.publish_note && (
                        <p className="text-xs italic text-gray-500 dark:text-gray-400">
                          &ldquo;{event.publish_note}&rdquo;
                        </p>
                      )}
                    </div>

                    <span className={`ml-3 mt-1 text-xs text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`}>▶</span>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-gray-200 px-4 pb-4 pt-3 dark:border-gray-800">
                      {/* Direct edits */}
                      {event.direct_edits.length > 0 && (
                        <div className="mb-3">
                          <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                            Direct Edits
                          </h4>
                          <div className="space-y-1">
                            {event.direct_edits.map((r) => (
                              <ChangeRow key={r.change_record_rid} r={r} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cascaded changes */}
                      {event.cascaded_changes.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                            Cascaded Changes ({event.cascaded_changes.length})
                          </h4>
                          <div className="space-y-1">
                            {event.cascaded_changes.map((r) => (
                              <ChangeRow key={r.change_record_rid} r={r} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
