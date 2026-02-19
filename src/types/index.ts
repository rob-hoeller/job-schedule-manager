export interface Job {
  job_id: string;
  job_rid: number;
  schedule_rid: number;
  community_name: string;
  lot_number: string;
  plan_name: string | null;
  start_date: string;
  estimated_end_date: string | null;
  status: string;
  created_on: string;
  updated_on: string;
}

export interface Activity {
  job_schedule_activity_id: string;
  jsa_rid: number;
  schedule_rid: number;
  description: string;
  trade_partner_name: string | null;
  status: string;
  original_duration: number | null;
  current_duration: number | null;
  original_start_date: string | null;
  current_start_date: string | null;
  original_end_date: string | null;
  current_end_date: string | null;
  approved_on: string | null;
  created_on: string;
  updated_on: string;
}

export interface Dependency {
  job_schedule_activity_dependency_id: string;
  jsa_dependency_rid: number;
  schedule_rid: number;
  predecessor_jsa_rid: number;
  successor_jsa_rid: number;
  dependency_type: "FS" | "SS";
  lag_days: number;
  created_on: string;
  updated_on: string;
}

export type SortField = "current_start_date" | "description" | "trade_partner_name" | "status";
export type SortDir = "asc" | "desc";
