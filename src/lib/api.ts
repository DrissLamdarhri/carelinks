/**
 * CareLink admin web — API helper. Runs entirely on Postgres via the Supabase
 * client under RLS. No KV edge function (make-server-aa5d1aa6 was retired with
 * the old web patient/pro preview demo).
 */
import { supabase } from "./supabase";

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function adminLogin(email: string, password: string) {
  // Real auth: sign in with Supabase, then require role='admin' (no hardcoded creds).
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    throw new Error("Identifiants incorrects");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    await supabase.auth.signOut();
    throw new Error("Accès réservé aux administrateurs");
  }
  return { success: true, message: "Admin connecté" };
}

// Admin functions run on Postgres directly under the admin session's RLS
// (role='admin' policies) — no KV edge function.

export async function getAdminStats() {
  const [users, pros, bookings, pendingKyc, ratingRows] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("professionals").select("id", { count: "exact", head: true }),
    supabase.from("bookings").select("id", { count: "exact", head: true }),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("verification_status", "pending"),
    supabase.from("professionals").select("rating_avg").gt("rating_count", 0),
  ]);
  const rated = (ratingRows.data ?? []).map((r: any) => Number(r.rating_avg)).filter((n: number) => n > 0);
  const avgRating = rated.length ? +(rated.reduce((s: number, n: number) => s + n, 0) / rated.length).toFixed(1) : 0;
  return {
    stats: {
      totalUsers: users.count ?? 0,
      totalProfessionals: pros.count ?? 0,
      totalPros: pros.count ?? 0,
      totalBookings: bookings.count ?? 0,
      pendingKyc: pendingKyc.count ?? 0,
      avgRating,
    },
  };
}

export async function getPendingPros() {
  const { data, error } = await supabase
    .from("professionals")
    .select("*, profile:profiles(id, full_name, email, phone, city, avatar_url)")
    .eq("verification_status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { professionals: data ?? [] };
}

export async function getProDocumentsAdmin(proId: string) {
  const { data, error } = await supabase
    .from("pro_documents")
    .select("*")
    .eq("professional_id", proId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { documents: data ?? [] };
}

export async function getAdminSignedUrl(path: string, bucket = "pro-documents", expires = 60) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expires);
  if (error) throw new Error(error.message);
  return { signedUrl: data.signedUrl, url: data.signedUrl };
}

export async function approvePro(proId: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("professionals")
    .update({ verification_status: "approved", verified_at: new Date().toISOString(), verified_by: u.user?.id ?? null })
    .eq("id", proId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function rejectPro(proId: string) {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("professionals")
    .update({ verification_status: "rejected", verified_at: new Date().toISOString(), verified_by: u.user?.id ?? null })
    .eq("id", proId);
  if (error) throw new Error(error.message);
  return { success: true };
}

// Single source of truth for telling a pro they were approved/rejected —
// in-app notification + email (Resend) + WhatsApp (Meta Cloud API), all sent
// server-side by the notify-pro-status edge function (auth'd via the caller's
// Supabase session; the function itself uses the service-role key to read the
// pro's contact details regardless of RLS).
//
// This replaced two separate edge functions (send-approval-email /
// send-rejection-email) that took no auth at all — anyone who found the URL
// could make them email an arbitrary address pretending to be CareLink. They
// were also never actually deployed to this project, so every caller of the
// old helpers was silently failing to notify anyone by email or WhatsApp
// (only the client-side in-app notification insert ever worked). Three
// separate admin screens each called them directly; all three now call this.
export async function notifyProStatus(
  proId: string,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke("notify-pro-status", {
      body: { proId, decision, reason },
    });
    const inApp = (data as { result?: { notification?: string } } | null)?.result?.notification;
    if (error || (typeof inApp === "string" && inApp.startsWith("error"))) {
      throw error ?? new Error(String(inApp));
    }
  } catch (e) {
    console.warn("notify-pro-status failed — falling back to a direct in-app notification", e);
    await supabase.from("notifications").insert({
      user_id: proId,
      kind: "system",
      title: decision === "approved" ? "Compte approuvé ✅" : "Dossier à corriger",
      body:
        decision === "approved"
          ? "Votre dossier a été validé. Vous pouvez maintenant recevoir des demandes."
          : reason || "Votre dossier nécessite des corrections. Merci de re-soumettre vos documents.",
      payload: { decision },
    });
  }
}

export async function getRecentBookings() {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return { bookings: data ?? [] };
}

// Services are managed in the service_types table (same one the mobile app reads).
export async function getAdminServices() {
  const { data, error } = await supabase.from("service_types").select("*").order("category").order("name");
  if (error) throw new Error(error.message);
  const services = (data ?? []).map((s: any) => ({
    id: s.id, name: s.name, category: s.category, base_price: 0, is_active: true,
  }));
  return { services };
}

export async function createAdminService(payload: {
  name: string; category: string; icon?: string; base_price?: number; duration?: number; description?: string; is_active?: boolean;
}) {
  const { data, error } = await supabase
    .from("service_types")
    .insert({ name: payload.name, category: payload.category })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return { service: data };
}

export async function updateAdminService(id: string | number, updates: any) {
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.category !== undefined) patch.category = updates.category;
  const { data, error } = await supabase.from("service_types").update(patch).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return { service: data };
}

export async function deleteAdminService(id: string | number) {
  const { error } = await supabase.from("service_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

