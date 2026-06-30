/**
 * CareLink – Frontend API helper
 * All calls go through the Supabase Edge Function server.
 * Auth token is passed in Authorization header.
 */
import { projectId, publicAnonKey } from "../../utils/supabase/info";
import { supabase } from "./supabase";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-aa5d1aa6`;
const ADMIN_KEY = "carelink-admin-2024";

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || publicAnonKey;
}

async function fetchAPI<T = any>(
  path: string,
  options: RequestInit = {},
  useAdminKey = false
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(useAdminKey ? { "X-Admin-Key": ADMIN_KEY } : {}),
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
  // Simple credential validation for demo admin account
  // In production, this would verify against a real admin user in the database
  if (email !== "admin@carelink.ma" || password !== "CareLinkAdmin2024!") {
    throw new Error("Identifiants incorrects");
  }
  return { success: true, message: "Admin connecté" };
}

export async function getAdminStats() {
  return fetchAPI("/admin/stats", {}, true);
}

export async function getPendingPros() {
  return fetchAPI("/admin/professionals/pending", {}, true);
}

export async function approvePro(proId: string) {
  return fetchAPI(`/admin/professionals/${proId}/approve`, { method: "PUT" }, true);
}

export async function rejectPro(proId: string) {
  return fetchAPI(`/admin/professionals/${proId}/reject`, { method: "PUT" }, true);
}

export async function getRecentBookings() {
  return fetchAPI("/admin/bookings/recent", {}, true);
}