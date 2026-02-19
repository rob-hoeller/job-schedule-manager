"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Job } from "@/types";

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("jobs")
      .select("*")
      .order("community_name")
      .order("lot_number")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setJobs(data ?? []);
        setLoading(false);
      });
  }, []);

  return { jobs, loading, error };
}
