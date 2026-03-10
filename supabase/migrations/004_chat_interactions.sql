-- Phase 3: Chat Interaction Log
-- Tracks all AI chat interactions for analysis and cost monitoring

CREATE TABLE chat_interactions (
  interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  job_schedule_rid UUID NOT NULL,
  user_message TEXT NOT NULL,
  ai_response JSONB NOT NULL,
  model_used TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd NUMERIC(10, 6),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_user ON chat_interactions(user_id);
CREATE INDEX idx_chat_schedule ON chat_interactions(job_schedule_rid);
CREATE INDEX idx_chat_timestamp ON chat_interactions(created_at);
