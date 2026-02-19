"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CalendarDay } from "@/types";

export function useCalendarDays(year: number) {
  const [days, setDays] = useState<Map<string, CalendarDay>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const from = `${year}-01-01`;
    const to = `${year}-12-31`;

    supabase
      .from("calendar_days")
      .select("*")
      .gte("day_date", from)
      .lte("day_date", to)
      .order("day_date")
      .limit(400)
      .then(({ data, error }) => {
        if (error || !data) {
          setDays(new Map());
        } else {
          const m = new Map<string, CalendarDay>();
          for (const d of data as CalendarDay[]) m.set(d.day_date, d);
          setDays(m);
        }
        setLoading(false);
      });
  }, [year]);

  return { days, loading };
}
