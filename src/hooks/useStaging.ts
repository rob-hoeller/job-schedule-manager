"use client";

import { useCallback, useEffect, useState } from "react";

export interface StagedChange {
  staged_change_rid: string;
  jsa_rid: number;
  job_schedule_rid: number;
  move_type: string;
  field_name: string;
  original_value: string | null;
  staged_value: string;
  is_direct_edit: boolean;
  source_jsa_rid: number | null;
}

interface StagingState {
  changes: StagedChange[];
  loading: boolean;
  directCount: number;
  cascadedCount: number;
  isActive: boolean;
  /** Map of jsa_rid → field_name → staged change */
  byActivity: Map<number, Map<string, StagedChange>>;
}

export function useStaging(scheduleRid: number | null) {
  const [state, setState] = useState<StagingState>({
    changes: [],
    loading: false,
    directCount: 0,
    cascadedCount: 0,
    isActive: false,
    byActivity: new Map(),
  });

  const refresh = useCallback(async () => {
    if (!scheduleRid) return;
    setState((s) => ({ ...s, loading: true }));

    const res = await fetch(`/api/staging?schedule_rid=${scheduleRid}`);
    const data = await res.json();
    const changes: StagedChange[] = data.changes ?? [];

    const byActivity = new Map<number, Map<string, StagedChange>>();
    for (const c of changes) {
      if (!byActivity.has(c.jsa_rid)) byActivity.set(c.jsa_rid, new Map());
      byActivity.get(c.jsa_rid)!.set(c.field_name, c);
    }

    setState({
      changes,
      loading: false,
      directCount: changes.filter((c) => c.is_direct_edit).length,
      cascadedCount: changes.filter((c) => !c.is_direct_edit).length,
      isActive: changes.length > 0,
      byActivity,
    });
  }, [scheduleRid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stageEdit = useCallback(
    async (jsaRid: number, moveType: "move_start" | "change_duration", value: string | number) => {
      if (!scheduleRid) return;
      setState((s) => ({ ...s, loading: true }));

      const res = await fetch("/api/staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsa_rid: jsaRid,
          schedule_rid: scheduleRid,
          move_type: moveType,
          value,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to stage edit");
      }

      await refresh();
    },
    [scheduleRid, refresh],
  );

  const discardAll = useCallback(async () => {
    if (!scheduleRid) return;
    setState((s) => ({ ...s, loading: true }));

    await fetch(`/api/staging?schedule_rid=${scheduleRid}`, { method: "DELETE" });
    await refresh();
  }, [scheduleRid, refresh]);

  const publish = useCallback(
    async (publishNote: string) => {
      if (!scheduleRid) return;
      setState((s) => ({ ...s, loading: true }));

      const res = await fetch("/api/staging/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedule_rid: scheduleRid,
          publish_note: publishNote,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to publish");
      }

      await refresh();
      return res.json();
    },
    [scheduleRid, refresh],
  );

  const updateStatus = useCallback(
    async (jsaRid: number, status: string, publishNote: string) => {
      if (!scheduleRid) return;

      const res = await fetch("/api/activities/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsa_rid: jsaRid,
          schedule_rid: scheduleRid,
          status,
          publish_note: publishNote,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update status");
      }

      return res.json();
    },
    [scheduleRid],
  );

  return {
    ...state,
    stageEdit,
    discardAll,
    publish,
    updateStatus,
    refresh,
  };
}
