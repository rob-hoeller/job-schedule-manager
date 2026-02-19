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
