// Integration check for the booking→bid→accept loop against the live DB.
// Run from repo root:  node supabase/verify-loop.mjs
//
// It signs UP two throwaway accounts (verify-patient-<ts>@, verify-pro-<ts>@) via
// the real GoTrue flow, runs the full loop, asserts each step, then deletes the
// test booking. NOTE: the two auth users can't be removed with the anon key, so
// a couple of dummy accounts accumulate per run — delete them from the Supabase
// dashboard (Auth → Users) occasionally. Uses the public anon key only.
import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const URL = "https://wjhzrovmktekfcjohhrw.supabase.co";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHpyb3Zta3Rla2Zjam9oaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjIyNjIsImV4cCI6MjA5MzA5ODI2Mn0.9JBvgWZVxrxsWMkniVI-MBt84SashdVRq_6tMnfaGYQ";

const mk = () =>
  createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: ws },
  });
const patient = mk();
const pro = mk();

let ok = 0, fail = 0;
const step = (name, cond, extra = "") => {
  if (cond) { console.log(`  ✅ ${name}`); ok++; }
  else { console.log(`  ❌ ${name}${extra ? "  → " + extra : ""}`); fail++; }
};

async function cleanup(bookingId) {
  if (!bookingId) return;
  const del = await patient.from("bookings").delete().eq("id", bookingId);
  console.log(del.error ? `  🧹 cleanup failed: ${del.error.message}` : "  🧹 test booking deleted");
}

function finish(code = 0) {
  console.log(`\n${fail === 0 ? "🎉 ALL PASS" : "⛔ FAILURES"} — ${ok} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

async function main() {
  console.log("Booking → bid → accept — live loop check\n");

  const ts = Date.now();
  const pIn = await patient.auth.signUp({
    email: `verify-patient-${ts}@carelink.test`,
    password: "CareLink123!",
    options: { data: { role: "patient", full_name: "Verify Patient" } },
  });
  step("patient sign-up + session", !pIn.error && !!pIn.data.session, pIn.error?.message ?? "no session (email confirmation is ON)");
  const prIn = await pro.auth.signUp({
    email: `verify-pro-${ts}@carelink.test`,
    password: "CareLink123!",
    options: { data: { role: "professional", full_name: "Verify Pro" } },
  });
  step("pro sign-up + session", !prIn.error && !!prIn.data.session, prIn.error?.message ?? "no session (email confirmation is ON)");
  if (!pIn.data.session || !prIn.data.session) return finish(1);

  const patientId = pIn.data.user.id;
  const proId = prIn.data.user.id;

  // Mirror the app: ensure patient + professional rows exist (FK targets).
  const pRow = await patient.from("patients").upsert({ id: patientId });
  step("patient row created", !pRow.error, pRow.error?.message);
  const prRow = await pro.from("professionals").upsert({ id: proId, specialty: "nurse" });
  step("professional row created", !prRow.error, prRow.error?.message);

  const cr = await patient
    .from("bookings")
    .insert({ patient_id: patientId, specialty: "nurse", status: "open", urgency: "normal", budget_min_mad: 120, budget_max_mad: 160, address: "TEST — verify loop" })
    .select("*").single();
  step("patient creates OPEN booking", !cr.error, cr.error?.message);
  if (cr.error) return finish(1);
  const bookingId = cr.data.id;

  const seen = await pro.from("bookings").select("id,status").eq("id", bookingId).maybeSingle();
  step("pro SEES open booking (RLS bookings_pro_view)", !seen.error && seen.data?.id === bookingId, seen.error?.message ?? "not visible");

  const bd = await pro
    .from("bids")
    .insert({ booking_id: bookingId, professional_id: proId, price_mad: 150, status: "pending" })
    .select("*").single();
  step("pro places BID", !bd.error, bd.error?.message);
  if (bd.error) { await cleanup(bookingId); return finish(1); }
  const bidId = bd.data.id;

  const sawBid = await patient.from("bids").select("id,status").eq("id", bidId).maybeSingle();
  step("patient SEES bid (RLS bids_patient_read)", !sawBid.error && sawBid.data?.id === bidId, sawBid.error?.message ?? "not visible");

  const acc = await patient.rpc("accept_bid", { p_bid_id: bidId });
  step("accept_bid() RPC succeeds", !acc.error, acc.error?.message);
  const matched = Array.isArray(acc.data) ? acc.data[0] : acc.data;
  step("booking is MATCHED to the pro", matched?.status === "matched" && matched?.professional_id === proId, `status=${matched?.status}`);

  const finalBid = await patient.from("bids").select("status").eq("id", bidId).maybeSingle();
  step("bid marked ACCEPTED", finalBid.data?.status === "accepted", `status=${finalBid.data?.status}`);

  // Tracking parity: can the PATIENT read the matched pro's name/avatar?
  const proProf = await patient.from("profiles").select("full_name,avatar_url").eq("id", proId).maybeSingle();
  step("patient can read matched pro name/avatar (tracking header)", !!proProf.data?.full_name,
    proProf.data?.full_name ? "" : "RLS blocks profiles.get → tracking shows generic 'Professionnel'");

  // get_track_coords should return dest + pro coords (+ pro identity once extended)
  const tc = await patient.rpc("get_track_coords", { b_id: bookingId });
  step("get_track_coords() RPC exists", !tc.error, tc.error?.message);
  if (!tc.error) {
    const row = Array.isArray(tc.data) ? tc.data[0] : tc.data;
    step("get_track_coords returns pro name (tracking header)", !!row?.pro_name,
      row?.pro_name ? "" : "RPC not extended with pro_name yet");
  }

  await cleanup(bookingId);
  finish();
}

main().catch((e) => { console.error(e); process.exit(1); });
