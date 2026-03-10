-- Fix: job_schedule_rid was UUID but schedule_rid values are integers
ALTER TABLE chat_interactions ALTER COLUMN job_schedule_rid TYPE BIGINT USING 0;
