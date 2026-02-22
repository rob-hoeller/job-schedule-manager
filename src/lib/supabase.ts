import { createClient } from "./supabase-browser";

// Re-export browser client for backward compatibility with existing hooks
export const supabase = createClient();
