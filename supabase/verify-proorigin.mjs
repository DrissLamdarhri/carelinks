// Verifies the REAL pro-origin path for tracking uses only DEPLOYED infra:
// v_pros_public exposes the matched pro's lat/lng. No get_track_coords needed.
import { createClient } from "@supabase/supabase-js";
import ws from "ws";
const URL = "https://wjhzrovmktekfcjohhrw.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHpyb3Zta3Rla2Zjam9oaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjIyNjIsImV4cCI6MjA5MzA5ODI2Mn0.9JBvgWZVxrxsWMkniVI-MBt84SashdVRq_6tMnfaGYQ";
const sb = createClient(URL, ANON, { auth: { persistSession: false }, realtime: { transport: ws } });
let ok = 0, fail = 0;
const step = (n, c, e = "") => { if (c) { console.log(`  ✅ ${n}`); ok++; } else { console.log(`  ❌ ${n}${e ? " → " + e : ""}`); fail++; } };

console.log("Real pro-origin (deployed infra) check\n");
const { data, error } = await sb.from("v_pros_public").select("id, full_name, lat, lng").not("lat", "is", null).limit(5);
step("v_pros_public returns approved pros with lat/lng", !error && data?.length > 0, error?.message ?? "no rows");
if (data?.length) {
  const p = data[0];
  step("a pro has real numeric coordinates", typeof p.lat === "number" && typeof p.lng === "number", `${p.full_name}: ${p.lat},${p.lng}`);
  console.log(`     → getProCoords('${p.id}') would return { lat:${p.lat}, lng:${p.lng} } (${p.full_name})`);
}
console.log(`\n${fail === 0 ? "🎉 PASS" : "⛔ FAIL"} — ${ok} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
