/**
 * CareLink — terms-of-use acceptance.
 *
 * The gate runs BEFORE authentication, so acceptance has two homes:
 *
 *   1. AsyncStorage, keyed by version — the device-level record. This is what
 *      unblocks the UI on launch, because at that moment there may be no
 *      session to query and the app must not hang on the network to decide
 *      whether it is allowed to draw a screen.
 *   2. `terms_acceptances` + `profiles.policy_*` — the durable record, written
 *      the moment a session exists. This is the one that is producible in a
 *      dispute; the local flag is a cache, not evidence.
 *
 * Because of (1), someone who accepts, signs up later, then reinstalls will be
 * asked again — the local flag is gone and we only reconcile forward. Asking
 * twice is the safe direction to fail.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase";

/**
 * Bump this whenever the SUBSTANCE of the terms changes — anything that alters
 * what the user is agreeing to. Every user is then re-prompted, and the new
 * acceptance is logged as its own row alongside the old one.
 *
 * Do NOT bump for a typo fix or a re-translation: that re-prompts everyone for
 * nothing and trains them to tap through without reading, which is precisely
 * what destroys the value of having asked.
 */
export const TERMS_VERSION = "2026-08-08";

const localKey = (v: string) => `carelink.terms.accepted.${v}`;

/** Has this device already accepted the current version? Never throws. */
export async function hasAcceptedLocally(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(localKey(TERMS_VERSION))) !== null;
  } catch {
    // Storage unavailable — show the gate. Blocking a user who already agreed
    // is recoverable; letting one through unasked is the failure that matters.
    return false;
  }
}

export async function markAcceptedLocally(): Promise<void> {
  try {
    await AsyncStorage.setItem(localKey(TERMS_VERSION), new Date().toISOString());
  } catch {
    /* best-effort: the DB record below is the one that counts */
  }
}

/**
 * Write the durable record. Safe to call repeatedly — the unique index on
 * (user_id, version) turns a re-accept into a no-op rather than a duplicate.
 *
 * Returns false if nothing was persisted server-side, so the caller can retry
 * later; it deliberately does NOT throw, because a logging failure must never
 * strand a user on the gate with no way forward.
 */
export async function recordAcceptance(locale: string, role?: string | null): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return false; // pre-auth: syncPendingAcceptance() picks it up at sign-in

    const { error } = await supabase.from("terms_acceptances").insert({
      user_id: uid,
      version: TERMS_VERSION,
      locale,
      role: role ?? null,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? null,
    });
    // 23505 = unique violation = already recorded. That is success, not failure.
    if (error && error.code !== "23505") return false;

    await supabase
      .from("profiles")
      .update({ policy_accepted_at: new Date().toISOString(), policy_version: TERMS_VERSION })
      .eq("id", uid);
    return true;
  } catch {
    return false;
  }
}

/**
 * Call once a session exists. Covers the ordinary case: the user accepted on
 * the launch gate, before any account existed, and only signed in afterwards —
 * without this, that acceptance would live nowhere but their phone.
 */
export async function syncPendingAcceptance(locale: string, role?: string | null): Promise<void> {
  if (!(await hasAcceptedLocally())) return;
  await recordAcceptance(locale, role);
}
