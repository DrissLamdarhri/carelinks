import { createClient, SupabaseClient } from "@supabase/supabase-js";

// TODO: Replace with actual Supabase credentials from https://supabase.com
const projectId = "wjhzrovmktekfcjohhrw";
const publicAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHpyb3Zta3Rla2Zjam9oaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjIyNjIsImV4cCI6MjA5MzA5ODI2Mn0.9JBvgWZVxrxsWMkniVI-MBt84SashdVRq_6tMnfaGYQ";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      }
    );
  }
  return _supabase;
}

export const supabase = getSupabase();