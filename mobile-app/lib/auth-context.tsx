/**
 * CareLink — React Native–safe AuthContext.
 *
 * Key differences from src/lib/auth-context.tsx (web):
 *   • No localStorage → AsyncStorage / expo-secure-store
 *   • OAuth → expo-web-browser + makeRedirectUri
 *   • Deep-link handling is done in the root _layout.tsx (not here)
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Buffer } from "buffer";
import * as Linking from "expo-linking";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { registerExpoPushToken } from "./push-native";
import { getOAuthRedirectUrl, getPasswordResetRedirectUrl } from "@/lib/auth-redirect";
import {
  enrollTotp,
  getAssuranceLevel,
  listTotpFactors,
  mfaStorage,
  normalizePhoneNumber,
  sendSmsOtp,
  verifySmsOtp,
  verifyTotp,
} from "@/lib/hooks/useMfa";
import { useAppleAuth } from "@/lib/hooks/useAppleAuth";
import { tr } from "./i18n";

// Lazy-import expo packages so this file can still be imported in unit tests
// without needing the full Expo environment.
let WebBrowser: typeof import("expo-web-browser") | null = null;
if (Platform.OS !== "web") {
  try {
    WebBrowser = require("expo-web-browser");
    WebBrowser?.maybeCompleteAuthSession?.();
  } catch {
    // expo packages not installed — running in unit test context
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "patient" | "pro" | "admin" | null;
export type MfaMethod = "totp" | "sms" | null;

export interface UserProfile {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  email: string;
  avatar: string;
  createdAt?: string;
  mfaEnabled: boolean;
  mfaMethod: MfaMethod;
}

export type SignInResult = {
  role: UserRole;
  mfaRequired: boolean;
};

export type SignUpResult = {
  userId: string | null;
  /** True when "Confirm email" is on and the account needs the link in their
   *  inbox clicked before they have a usable session. No profile/professional
   *  row exists yet in that case — see fetchProfile's bootstrap. */
  needsEmailConfirmation: boolean;
};

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  mfaEnabled: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: (intendedRole?: "patient" | "pro") => Promise<SignInResult>;
  signInWithApple: (intendedRole?: "patient" | "pro") => Promise<SignInResult>;
  signInWithEmail: (
    email: string,
    password: string,
    intendedRole?: "patient" | "pro"
  ) => Promise<SignInResult>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string,
    role: "patient" | "pro",
    options?: { phone?: string; city?: string; profession?: string; services?: string[]; experience?: string; documents?: Array<{ doc_type: string; storage_path: string }> }
  ) => Promise<SignUpResult>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  enrollMfaTotp: () => Promise<{ factorId: string; qrCode: string; secret: string }>;
  verifyMfaTotp: (code: string, factorId?: string) => Promise<void>;
  challengeMfaSms: (phone: string) => Promise<void>;
  verifyMfaSms: (phone: string, code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  mfaEnabled: false,
  refreshProfile: async () => {},
  signOut: async () => {},
  signInWithGoogle: async () => ({ role: null, mfaRequired: false }),
  signInWithApple: async () => ({ role: null, mfaRequired: false }),
  signInWithEmail: async () => ({ role: null, mfaRequired: false }),
  signUpWithEmail: async () => ({ userId: null, needsEmailConfirmation: false }),
  resendConfirmationEmail: async () => {},
  sendPasswordReset: async () => {},
  updatePassword: async () => {},
  enrollMfaTotp: async () => ({ factorId: "", qrCode: "", secret: "" }),
  verifyMfaTotp: async () => {},
  challengeMfaSms: async () => {},
  verifyMfaSms: async () => {},
});

// ── Helper: build UserProfile from Supabase profile row ──────────────────────
async function fetchProfileFromSupabase(
  userId: string
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const nameParts = (data.full_name ?? "").split(" ");
  const method = data.mfa_method === "totp" || data.mfa_method === "sms" ? data.mfa_method : null;
  return {
    id: data.id,
    role: (data.role === "professional" ? "pro" : data.role) as UserRole,
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" "),
    phone: data.phone ?? "",
    city: data.city ?? "",
    email: data.email ?? "",
    avatar: data.avatar_url ?? "",
    createdAt: data.created_at,
    mfaEnabled: Boolean(data.mfa_enabled),
    mfaMethod: method,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { signInWithApple: startAppleSignIn } = useAppleAuth();

  const role: UserRole = profile?.role ?? null;
  const mfaEnabled = Boolean(profile?.mfaEnabled);

  const updateProfileMfa = async (enabled: boolean, method: MfaMethod) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ mfa_enabled: enabled, mfa_method: method })
      .eq("id", user.id);
    if (error) throw error;
    setProfile((prev) =>
      prev ? { ...prev, mfaEnabled: enabled, mfaMethod: method } : prev
    );
  };

  const fetchProfile = async (authUser: User): Promise<UserProfile | null> => {
    const metadataAvatarUrl =
      (authUser.user_metadata?.picture as string | undefined) ??
      (authUser.user_metadata?.avatar_url as string | undefined) ??
      null;

    let p = await fetchProfileFromSupabase(authUser.id);
    if (!p) {
      const intendedRole = await AsyncStorage.getItem("carelink_intended_role");
      const role = intendedRole === "pro" ? "professional" : "patient";
      const fullName =
        (authUser.user_metadata?.full_name as string | undefined) ??
        (authUser.user_metadata?.name as string | undefined) ??
        authUser.email?.split("@")[0] ??
        "CareLink User";
      const phone =
        (authUser.user_metadata?.phone as string | undefined) ?? "";
      const city = (authUser.user_metadata?.city as string | undefined) ?? "";
      const { error: profileError } = await supabase.from("profiles").insert({
        id: authUser.id,
        role,
        full_name: fullName,
        language: "fr",
        phone: phone || null,
        city: city || null,
        avatar_url: metadataAvatarUrl || null,
      });
      if (profileError && profileError.code !== "23505") throw profileError;

      if (role === "patient") {
        const { error: patientError } = await supabase
          .from("patients")
          .upsert({ id: authUser.id });
        if (patientError) throw patientError;
      } else {
        // profession/experience come from user_metadata rather than being
        // hardcoded: when "Confirm email" is on, signUpWithEmail can't write
        // this row itself (no session exists yet at signup time), so this is
        // the only place it's ever created for an email/password pro — it
        // must carry through what they actually chose at registration.
        const specialty = (authUser.user_metadata?.profession as string | undefined) || "nurse";
        const experience = authUser.user_metadata?.experience
          ? parseInt(authUser.user_metadata.experience as string, 10) || 0
          : 0;
        const { error: professionalError } = await supabase
          .from("professionals")
          .upsert({ id: authUser.id, specialty, years_experience: experience });
        if (professionalError) throw professionalError;

        // Documents picked before signup couldn't be uploaded then either (no
        // session, and the pro-documents bucket requires one) — pro-registration.tsx
        // stashes them locally keyed by this uid; upload them now that a real
        // session finally exists. Best-effort: if this fails (e.g. the app was
        // closed and cache cleared before confirming), the pro can still
        // re-upload from Profil → Documents, which already exists.
        try {
          const raw = await AsyncStorage.getItem(`pending_pro_docs_${authUser.id}`);
          if (raw) {
            const pending = JSON.parse(raw) as Array<{ type: string; uri: string; name: string; mimeType: string }>;
            for (const doc of pending) {
              try {
                const fileContent = await FileSystem.readAsStringAsync(doc.uri, { encoding: FileSystem.EncodingType.Base64 });
                const bytes = Buffer.from(fileContent, "base64");
                const ext = doc.name.split(".").pop() || "jpg";
                const storagePath = `${authUser.id}/${doc.type}-${Date.now()}.${ext}`;
                const { error: uploadError } = await supabase.storage
                  .from("pro-documents")
                  .upload(storagePath, bytes, { contentType: doc.mimeType || "image/jpeg", upsert: true });
                if (uploadError) { console.warn("[Auth] Deferred document upload failed:", doc.type, uploadError.message); continue; }
                await supabase.from("pro_documents").insert({
                  professional_id: authUser.id,
                  doc_type: doc.type,
                  storage_path: storagePath,
                  is_verified: false,
                  uploaded_at: new Date().toISOString(),
                });
              } catch (e) {
                console.warn("[Auth] Deferred document upload exception:", doc.type, e);
              }
            }
            await AsyncStorage.removeItem(`pending_pro_docs_${authUser.id}`);
          }
        } catch (e) {
          console.warn("[Auth] Reading pending documents failed:", e);
        }
      }

      p = await fetchProfileFromSupabase(authUser.id);
    } else if (!p.avatar && metadataAvatarUrl) {
      const { error: avatarError } = await supabase
        .from("profiles")
        .update({ avatar_url: metadataAvatarUrl })
        .eq("id", authUser.id);
      if (avatarError) throw avatarError;
      p = { ...p, avatar: metadataAvatarUrl };
    }
    if (p) setProfile(p);
    return p;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user);
  };

  const awaitSessionFromOAuth = async (): Promise<Session> => {
    const { data: existing } = await supabase.auth.getSession();
    if (existing.session) return existing.session;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription.unsubscribe();
        reject(new Error(tr("cmp_oauth_expired")));
      }, 15000);
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (newSession?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
          clearTimeout(timeout);
          subscription.unsubscribe();
          resolve(newSession);
        }
      });
    });
  };

  const exchangeOAuthCodeFromUrl = async (redirectUrl: string) => {
    const { queryParams } = Linking.parse(redirectUrl);
    const rawOAuthError = queryParams?.error_description ?? queryParams?.error;
    const oauthError =
      typeof rawOAuthError === "string"
        ? rawOAuthError
        : Array.isArray(rawOAuthError) && rawOAuthError.length > 0
          ? rawOAuthError[0]
          : null;
    if (oauthError) {
      throw new Error(oauthError);
    }

    const rawCode = queryParams?.code;
    const code =
      typeof rawCode === "string"
        ? rawCode
        : Array.isArray(rawCode) && rawCode.length > 0
          ? rawCode[0]
          : null;
    if (!code) return;

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  };

  // MFA removed (client did not want it): sign-in never requires an MFA step.
  const resolveMfaRequirement = async (_p: UserProfile | null): Promise<boolean> => {
    return false;
  };

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          void registerExpoPushToken(data.session.user.id);
          fetchProfile(data.session.user).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error("Failed to read auth session:", error);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        void registerExpoPushToken(newSession.user.id);
        await fetchProfile(newSession.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Sign out ────────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    await mfaStorage.clearFactorId();
    setProfile(null);
    setUser(null);
    setSession(null);
    await AsyncStorage.removeItem("carelink_intended_role");
  };

  // ── Google OAuth (Expo WebBrowser) ──────────────────────────────────────────
  const signInWithGoogle = async (
    intendedRole: "patient" | "pro" = "patient"
  ): Promise<SignInResult> => {
    await AsyncStorage.setItem("carelink_intended_role", intendedRole);

    const redirectTo = getOAuthRedirectUrl();
    const shouldSkipRedirect = Platform.OS !== "web";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: shouldSkipRedirect,
      },
    });
    if (error) throw error;

    if (!shouldSkipRedirect) {
      return { role: intendedRole, mfaRequired: false };
    }

    if (!data.url || !WebBrowser) throw new Error(tr("cmp_oauth_browser_unavailable"));
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") throw new Error(tr("cmp_google_cancelled"));
    if (!result.url) throw new Error(tr("cmp_oauth_redirect_missing"));
    const { data: existingSessionData } = await supabase.auth.getSession();
    if (!existingSessionData.session) {
      await exchangeOAuthCodeFromUrl(result.url);
    }

    const oauthSession = await awaitSessionFromOAuth();
    const p = oauthSession.user ? await fetchProfile(oauthSession.user) : null;
    const mfaRequired = oauthSession.user ? await resolveMfaRequirement(p) : false;
    return { role: p?.role ?? intendedRole, mfaRequired };
  };

  // ── Apple OAuth (Expo WebBrowser) ───────────────────────────────────────────
  const signInWithApple = async (
    intendedRole: "patient" | "pro" = "patient"
  ): Promise<SignInResult> => {
    await AsyncStorage.setItem("carelink_intended_role", intendedRole);
    await startAppleSignIn();

    if (Platform.OS === "web") {
      return { role: intendedRole, mfaRequired: false };
    }

    const oauthSession = await awaitSessionFromOAuth();
    const p = oauthSession.user ? await fetchProfile(oauthSession.user) : null;
    const mfaRequired = oauthSession.user ? await resolveMfaRequirement(p) : false;
    return { role: p?.role ?? intendedRole, mfaRequired };
  };

  // ── Email/password sign-in ──────────────────────────────────────────────────
  const signInWithEmail = async (
    email: string,
    password: string,
    intendedRole: "patient" | "pro" = "patient"
  ): Promise<SignInResult> => {
    await AsyncStorage.setItem("carelink_intended_role", intendedRole);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      // Supabase's raw message here is the English string "Email not
      // confirmed" — surfaced as a distinct code so the login screens can
      // show a translated message with a "resend the email" action instead
      // of a generic "wrong password" error.
      if (error.message?.toLowerCase().includes("email not confirmed")) {
        throw new Error("EMAIL_NOT_CONFIRMED");
      }
      throw error;
    }
    if (!data.user) return { role: intendedRole, mfaRequired: false };
    const p = await fetchProfile(data.user);
    const mfaRequired = await resolveMfaRequirement(p);
    return { role: p?.role ?? intendedRole, mfaRequired };
  };

  // ── Password reset (email link → app/auth/reset-password) ───────────────────
  const sendPasswordReset = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: getPasswordResetRedirectUrl(),
    });
    if (error) {
      // A raw network/server failure (Supabase Auth 500s with an empty body
      // when its "Reset Password" email template is broken) can surface as
      // React Native's fetch Response dumped wholesale into `.message` — an
      // unreadable JSON blob with headers/alt-svc/etc. Never show that; a
      // real Supabase auth message (e.g. rate limiting) stays short and
      // human, so only replace the long/JSON-shaped ones.
      const raw = error.message ?? "";
      const looksRaw = raw.length > 120 || raw.trim().startsWith("{");
      throw new Error(
        looksRaw
          ? tr("cmp_reset_email_rate_limited")
          : raw || tr("cmp_reset_email_failed"),
      );
    }
  };

  const updatePassword = async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  // ── Email/password sign-up ──────────────────────────────────────────────────
  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    role: "patient" | "pro",
    options?: { phone?: string; city?: string; profession?: string; services?: string[]; experience?: string; documents?: Array<{ doc_type: string; storage_path: string }> }
  ): Promise<SignUpResult> => {
    await AsyncStorage.setItem("carelink_intended_role", role);
    console.log("[Auth] Attempting signup with:", { email, password: "***", fullName, role });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getOAuthRedirectUrl(),
        data: {
          full_name: fullName,
          phone: options?.phone || null,
          city: options?.city || null,
          profession: options?.profession || null,
          services: options?.services || null,
          // Kept in user_metadata (survives the confirmation gap below) so the
          // professional row can be created correctly on first real login.
          experience: options?.experience || null,
          intended_role: role === "pro" ? "professional" : "patient",
          role: role === "pro" ? "professional" : "patient", // Also pass as 'role' for the trigger
        },
      },
    });
    if (error) {
      console.error("[Auth] Signup error details:", {
        code: error.code,
        message: error.message,
        status: error.status,
        fullError: JSON.stringify(error),
      });
      throw new Error(error?.message ?? tr("cmp_signup_server_error"));
    }
    console.log("[Auth] Signup successful, user:", data.user?.id);

    // With "Confirm email" enabled, signUp returns a user but NO session until
    // they click the link in their inbox — the client is still on the `anon`
    // role at this point, so every RLS-protected write below (profiles,
    // professionals, pro_documents) would be silently rejected if attempted
    // now. Skip them entirely and let the same bootstrap that already handles
    // first-ever OAuth login (fetchProfile, below) create everything once a
    // real session exists — it reads full_name/phone/city/profession/
    // experience straight back out of user_metadata.
    if (!data.session) {
      return { userId: data.user?.id ?? null, needsEmailConfirmation: true };
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        role: role === "pro" ? "professional" : "patient",
        full_name: fullName,
        phone: options?.phone ?? null,
        city: options?.city ?? null,
        language: "fr",
      });
      if (profileError) throw profileError;

      if (role === "patient") {
        const { error: patientError } = await supabase
          .from("patients")
          .upsert({ id: data.user.id });
        if (patientError) throw patientError;
      } else {
        const { error: professionalError } = await supabase
          .from("professionals")
          .upsert({
            id: data.user.id,
            specialty: options?.profession || "nurse",
            years_experience: options?.experience ? parseInt(options.experience) : 0,
          });
        if (professionalError) throw professionalError;

        // Insert documents if provided — prefer supabase-js client insert (uses user's session & RLS)
        if (options?.documents && options.documents.length > 0) {
          try {
            const uid = data.user.id;
            const docsToInsert = options.documents.map((d: any) => ({
              professional_id: uid,
              doc_type: d.doc_type,
              storage_path: d.storage_path,
              is_verified: false,
              uploaded_at: new Date().toISOString(),
            }));

            console.log("[Auth] Attempting pro_documents insert via supabase client", { count: docsToInsert.length });

            // Direct insert under RLS (prodocs_owner_all). No KV edge-function
            // fallback — the pro_documents RLS lets the owner insert their rows.
            const { error: insertError } = await supabase.from("pro_documents").insert(docsToInsert).select();
            if (insertError) {
              console.warn("[Auth] pro_documents insert error:", insertError.message);
            }
          } catch (e) {
            console.error("[Auth] Exception inserting documents via supabase client:", e);
          }
        }
      }
    }
    return { userId: data.user?.id ?? null, needsEmailConfirmation: false };
  };

  // Lets someone re-trigger the confirmation email (typo'd inbox, link expired,
  // spam folder) without having to sign up again.
  const resendConfirmationEmail = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: getOAuthRedirectUrl() },
    });
    if (error) throw error;
  };

  // ── MFA helpers ─────────────────────────────────────────────────────────────
  const enrollMfaTotp = async () => {
    return enrollTotp();
  };

  const resolveTotpFactorId = async (factorId?: string): Promise<string> => {
    if (factorId) return factorId;
    const stored = await mfaStorage.getFactorId();
    if (stored) return stored;
    const factors = await listTotpFactors();
    const verified = factors.find((factor) => factor.status === "verified") ?? factors[0];
    if (!verified) throw new Error(tr("cmp_no_totp_factor"));
    await mfaStorage.setFactorId(verified.id);
    return verified.id;
  };

  const verifyMfaTotp = async (code: string, factorId?: string) => {
    const resolvedId = await resolveTotpFactorId(factorId);
    await verifyTotp(resolvedId, code);
    await updateProfileMfa(true, "totp");
  };

  const challengeMfaSms = async (phone: string) => {
    const normalized = normalizePhoneNumber(phone);
    await sendSmsOtp(normalized);
  };

  const verifyMfaSms = async (phone: string, code: string) => {
    const normalized = normalizePhoneNumber(phone);
    await verifySmsOtp(normalized, code);
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      await fetchProfile(data.session.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        mfaEnabled,
        refreshProfile,
        signOut: handleSignOut,
        signInWithGoogle,
        signInWithApple,
        signInWithEmail,
        sendPasswordReset,
        updatePassword,
        signUpWithEmail,
        resendConfirmationEmail,
        enrollMfaTotp,
        verifyMfaTotp,
        challengeMfaSms,
        verifyMfaSms,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

