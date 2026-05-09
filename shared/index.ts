/**
 * @carelink/shared — public API
 * Import from this barrel in mobile/ screens:
 *   import { supabase, db, useAuth, useI18n, useBookingBids } from "@carelink/shared";
 */

export { supabase, getSupabase } from "./supabase";
export { db, profiles, patients, pros, services, proServices, proDocuments, bookings, bids, ratings, yoga, messages } from "./db/dal";
export type { Profile, Patient, Professional, Service, ProService, ProDocument, Booking, Bid, Rating, YogaSession, YogaEnrollment, Message, Notification as DbNotification, PublicPro, UserRole as DbUserRole, ProSpecialty, BookingStatus, BidStatus, VerificationStatus, UrgencyLevel, NotificationKind, UUID, ISODate } from "./db/types";
export { toDbSpecialty } from "./db/types";
export { useBookingBids, usePatientBookings, useOpenBookingsBySpecialty, useBookingMessages, useUserNotifications } from "./db/realtime";
export { AuthProvider, useAuth } from "./auth-context";
export type { UserProfile, UserRole } from "./auth-context";
export { I18nProvider, useI18n } from "./i18n";
export type { Locale } from "./i18n";
export { registerExpoPushToken, configureNotifications } from "./push-native";
