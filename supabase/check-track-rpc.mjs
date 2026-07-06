// Lightweight: is get_track_coords() deployed? (no auth, no test data)
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
const URL = "https://wjhzrovmktekfcjohhrw.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHpyb3Zta3Rla2Zjam9oaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjIyNjIsImV4cCI6MjA5MzA5ODI2Mn0.9JBvgWZVxrxsWMkniVI-MBt84SashdVRq_6tMnfaGYQ";
const sb = createClient(URL, ANON, { auth: { persistSession: false }, realtime: { transport: ws } });
const { error } = await sb.rpc("get_track_coords", { b_id: "00000000-0000-0000-0000-000000000000" });
const notFound = error && (error.code === "PGRST202" || /Could not find the function/i.test(error.message || ""));
console.log(notFound ? "NOT_DEPLOYED" : "DEPLOYED" + (error ? ` (call err: ${error.message})` : " (callable)"));
process.exit(notFound ? 1 : 0);
