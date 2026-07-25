/**
 * Patient identity (CIN) verification state + the booking gate.
 *
 * Product rule (migration 0030): a patient signs up freely, but must verify
 * their CIN before their FIRST booking — a nurse enters their home, so the
 * patient has to be identifiable. Verifying at first booking rather than at
 * signup keeps the funnel fast (the inDrive model) while still meeting the
 * requirement.
 *
 * Usage in a booking screen:
 *   const { ensureVerified } = useIdentityGate();
 *   ...
 *   if (!(await ensureVerified())) return;   // routes to the CIN screen
 *   await db.bookings.create(...)
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { IdentityStatus } from "@/lib/db/types";

export function useIdentityVerification() {
  const { user } = useAuth();
  const [status, setStatus] = useState<IdentityStatus | undefined>(undefined); // undefined = loading
  const [reason, setReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("patients")
      .select("id_status, id_rejection_reason")
      .eq("id", user.id)
      .maybeSingle();
    setStatus((data?.id_status as IdentityStatus) ?? "unverified");
    setReason(data?.id_rejection_reason ?? null);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live-update so an admin decision releases the patient without a restart.
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`identity-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "patients", filter: `id=eq.${user.id}` },
        (payload: { new?: { id_status?: string; id_rejection_reason?: string | null } }) => {
          if (payload.new?.id_status) setStatus(payload.new.id_status as IdentityStatus);
          setReason(payload.new?.id_rejection_reason ?? null);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user?.id]);

  return {
    status,
    reason,
    reload: load,
    loading: status === undefined,
    verified: status === "approved",
    awaitingReview: status === "pending",
  };
}

/**
 * Gate helper for booking screens. Returns true when the patient may proceed.
 * When they may not, it navigates to the verification screen and returns false.
 */
export function useIdentityGate() {
  const router = useRouter();
  const { user } = useAuth();

  const ensureVerified = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    const { data } = await supabase
      .from("patients")
      .select("id_status")
      .eq("id", user.id)
      .maybeSingle();
    const status = (data?.id_status as IdentityStatus) ?? "unverified";
    if (status === "approved") return true;
    router.push("/patient/verify-identity");
    return false;
  }, [router, user?.id]);

  return { ensureVerified };
}
