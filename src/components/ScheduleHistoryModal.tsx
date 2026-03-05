"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/utils";

interface ScheduleEvent {
  publish_event_rid: number;
  published_at: string;
  publish_note: string | null;
  move_types: string[] | string | null;
  change_count: number | null;
  direct_edit_count: number | null;
  cascaded_count: number | null;
  user_display_name: string;
}

interface EventRecord {
  change_record_rid?: number;
  jsa_rid: number;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  is_direct_edit: boolean;
  activity_description: string;
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

export function ScheduleHistoryModal({ scheduleRid, open, onClose }: Props) {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [eventRecords, setEventRecords] = useState<Record<number, EventRecord[]>>({});
  const [recordsLoading, setRecordsLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    fetch(`/api/history/schedule?schedule_rid=${scheduleRid}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setEvents(data.events ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, scheduleRid]);

  useEffect(() => {
    if (!expanded || eventRecords[expanded] || recordsLoading[expanded]) return;
    setRecordsLoading((prev) => ({ ...prev, [expanded]: true }));
    fetch(`/api/history/event?publish_event_rid=${expanded}`)
      .then((res) => res.json())
      .then((data) => {
        setEventRecords((prev) => ({ ...prev, [expanded]: data.records ?? [] }));
      })
      .finally(() => {
        setRecordsLoading((prev) => ({ ...prev, [expanded]: false }));
      });
  }, [expanded, eventRecords, recordsLoading]);

  const moveTypeLabel = useMemo(() => {
    return (value: ScheduleEvent["move_types"]) => {
      if (!value) return "—";
      const arr = Array.isArray(value) ? value : [value];
      if (arr.length === 0) return "—";
      return arr.join(", ");
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Schedule History</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Publish events and change details</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
        </div>

        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Loading history…</p>}
        {!loading && events.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No publish history recorded.</p>
        )}

        <div className="space-y-3">
          {events.map((event) => {
            const isOpen = expanded === event.publish_event_rid;
            const records = eventRecords[event.publish_event_rid] ?? [];
            const isLoading = recordsLoading[event.publish_event_rid];
            return (
              <div key={event.publish_event_rid} className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-950/30">
                <button
                  onClick={() => setExpanded(isOpen ? null : event.publish_event_rid)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatTimestamp(event.published_at)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Published by <span className="font-medium text-gray-700 dark:text-gray-300">{event.user_display_name}</span>
                    </div>
                  </div>
                  <span className={`text-xs text-gray-400 transition ${isOpen ? "rotate-90" : ""}`}>▶</span>
                </button>

                <div className="mt-3 grid gap-2 text-xs text-gray-600 dark:text-gray-400 sm:grid-cols-2">
                  <div>
                    <span className="text-gray-500">Note: </span>{event.publish_note || "—"}
                  </div>
                  <div>
                    <span className="text-gray-500">Move types: </span>{moveTypeLabel(event.move_types)}
                  </div>
                  <div>
                    <span className="text-gray-500">Changes: </span>{event.change_count ?? 0}
                    <span className="ml-1 text-gray-500">({event.direct_edit_count ?? 0} direct, {event.cascaded_count ?? 0} cascaded)</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 dark:border-gray-800">
                    {isLoading && <p className="text-xs text-gray-500 dark:text-gray-400">Loading changes…</p>}
                    {!isLoading && records.length === 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">No change records found.</p>
                    )}
                    {!isLoading && records.map((record) => (
                      <div key={`${event.publish_event_rid}-${record.change_record_rid ?? record.jsa_rid}-${record.field_name}`} className="flex flex-col gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{record.activity_description}</span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              record.is_direct_edit
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                            }`}
                          >
                            {record.is_direct_edit ? "Direct" : "Cascaded"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-gray-600 dark:text-gray-400">
                          <span className="font-medium text-gray-700 dark:text-gray-300">{fieldLabel(record.field_name)}:</span>
                          <span className="rounded bg-gray-50 px-2 py-0.5 dark:bg-gray-800">{formatValue(record.field_name, record.old_value)}</span>
                          <span className="text-gray-400">→</span>
                          <span className="rounded bg-gray-50 px-2 py-0.5 dark:bg-gray-800">{formatValue(record.field_name, record.new_value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
