/**
 * CareLink – Frontend API helper
 * All calls go through the Supabase Edge Function server.
 * Auth token is passed in Authorization header.
 */
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { supabase } from "./supabase";

// Legacy KV edge function — now used ONLY by the web patient/pro *preview* demo
// flows below. All admin + auth functions run on Postgres directly. To fully
// delete make-server-aa5d1aa6, migrate or remove the remaining preview flows.
const BASE = `https://${projectId}.supabase.co/functions/v1/server/make-server-aa5d1aa6`;

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || publicAnonKey;
}

async function fetchAPI<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// ── Auth ────────────────────────────────────────────────────────────────���────

export async function signUpPatient(payload: {
  email: string; password: string; firstName: string;
  lastName: string; phone: string; city: string;
}) {
  return fetchAPI("/auth/patient-signup", { method: "POST", body: JSON.stringify(payload) });
}

export async function signUpPro(payload: {
  email: string; password: string; firstName: string; lastName: string;
  phone: string; city: string; specialty: string; experience: string;
  specialties: string[]; minPrice: number; availDays: string[];
  startTime: string; endTime: string;
}) {
  return fetchAPI("/auth/pro-signup", { method: "POST", body: JSON.stringify(payload) });
}

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

// ── User Profiles ────────────────────────────────────────────────────────────

export async function getUser(userId: string) {
  return fetchAPI(`/users/${userId}`);
}

export async function updateUser(userId: string, updates: Partial<any>) {
  return fetchAPI(`/users/${userId}`, { method: "PUT", body: JSON.stringify(updates) });
}

// ── Professionals ────────────────────────────────────────────────────────────

export async function getProfessionals(filters?: { city?: string; specialty?: string }) {
  const params = new URLSearchParams();
  if (filters?.city) params.set("city", filters.city);
  if (filters?.specialty) params.set("specialty", filters.specialty);
  return fetchAPI(`/professionals?${params}`);
}

export async function getProfessional(proId: string) {
  return fetchAPI(`/professionals/${proId}`);
}

export async function updateProfessional(proId: string, updates: Partial<any>) {
  return fetchAPI(`/professionals/${proId}`, { method: "PUT", body: JSON.stringify(updates) });
}

export async function setProOnlineStatus(proId: string, isOnline: boolean) {
  return fetchAPI(`/professionals/${proId}/online`, {
    method: "PUT", body: JSON.stringify({ isOnline }),
  });
}

// ── Care Requests (Bidding) ──────────────────────────────────────────────────

export async function createRequest(payload: {
  careType: string; dateStr: string; timeStr: string;
  address: string; city: string; proposedPrice: number; notes?: string;
}) {
  return fetchAPI("/requests", { method: "POST", body: JSON.stringify(payload) });
}

export async function getMyRequests() {
  return fetchAPI("/requests?role=patient");
}

export async function getPendingRequests(city?: string) {
  const params = city ? `?role=pro&city=${encodeURIComponent(city)}` : "?role=pro";
  return fetchAPI(`/requests${params}`);
}

export async function getRequest(requestId: string) {
  return fetchAPI(`/requests/${requestId}`);
}

export async function cancelRequest(requestId: string) {
  return fetchAPI(`/requests/${requestId}/cancel`, { method: "PUT" });
}

// ── Offers ───────────────────────────────────────────────────────────────────

export async function submitOffer(requestId: string, price: number) {
  return fetchAPI(`/requests/${requestId}/offers`, {
    method: "POST", body: JSON.stringify({ price }),
  });
}

export async function getOffersForRequest(requestId: string) {
  return fetchAPI(`/requests/${requestId}/offers`);
}

export async function acceptOffer(offerId: string) {
  return fetchAPI(`/offers/${offerId}/accept`, { method: "PUT" });
}

export async function rejectOffer(offerId: string) {
  return fetchAPI(`/offers/${offerId}/reject`, { method: "PUT" });
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export async function getMyBookings(role: "patient" | "pro" = "patient") {
  return fetchAPI(`/bookings?role=${role}`);
}

export async function getBooking(bookingId: string) {
  return fetchAPI(`/bookings/${bookingId}`);
}

export async function completeBooking(bookingId: string) {
  return fetchAPI(`/bookings/${bookingId}/complete`, { method: "PUT" });
}

export async function rateBooking(bookingId: string, rating: number, comment?: string) {
  return fetchAPI(`/bookings/${bookingId}/rate`, {
    method: "POST", body: JSON.stringify({ rating, comment }),
  });
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

export async function sendApprovalEmail(email: string, name: string, specialty?: string) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-approval-email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, name, specialty }),
  });
  return res.json();
}

export async function sendRejectionEmail(email: string, name: string, reason?: string) {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-rejection-email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, name, reason }),
  });
  return res.json();
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

