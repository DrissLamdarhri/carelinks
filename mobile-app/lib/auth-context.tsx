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
import * as Linking from "expo-linking";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
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
  ) => Promise<string | null>;
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
  signUpWithEmail: async () => null,
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
        const { error: professionalError } = await supabase
          .from("professionals")
          .upsert({ id: authUser.id, specialty: "nurse" });
        if (professionalError) throw professionalError;
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
        reject(new Error("Connexion OAuth expirée."));
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

    if (!data.url || !WebBrowser) throw new Error("Navigateur OAuth indisponible.");
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== "success") throw new Error("Connexion Google annulée.");
    if (!result.url) throw new Error("URL de redirection OAuth manquante.");
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
    if (error) throw error;
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
    if (error) throw error;
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
  ) => {
    await AsyncStorage.setItem("carelink_intended_role", role);
    console.log("[Auth] Attempting signup with:", { email, password: "***", fullName, role });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: options?.phone || null,
          city: options?.city || null,
          profession: options?.profession || null,
          services: options?.services || null,
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
      throw new Error(error?.message ?? "Erreur serveur lors de l'inscription. Vérifiez la configuration Supabase.");
    }
    console.log("[Auth] Signup successful, user:", data.user?.id);
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

            const { data: insertedDocs, error: insertError } = await supabase.from("pro_documents").insert(docsToInsert).select();
            if (insertError) {
              console.warn("[Auth] pro_documents insert (client) error:", insertError);

              // Fallback: call server function if client-side insert is blocked (log URL for debugging)
              const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://wjhzrovmktekfcjohhrw.supabase.co";
              const fnUrl = `${SUPABASE_URL}/functions/v1/server/make-server-aa5d1aa6/professionals/documents`;
              console.log("[Auth] Falling back to server function URL (for diagnostics):", fnUrl);

              try {
                const sessionRes2 = await supabase.auth.getSession();
                const token2 = sessionRes2.data?.session?.access_token ?? null;
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (token2) headers["Authorization"] = "Bearer " + token2;

                const resp = await fetch(fnUrl, {
                  method: "POST",
                  headers,
                  body: JSON.stringify({ professional_id: data.user.id, documents: options.documents, auth_token: token2 }),
                });

                let bodyText: string | null = null;
                try { bodyText = await resp.text(); } catch (e) { bodyText = null; }
                if (!resp.ok) {
                  console.error("[Auth] server function fallback failed:", resp.status, bodyText);
                } else {
                  console.log("[Auth] server function fallback succeeded:", bodyText);
                }
              } catch (e) {
                console.error("[Auth] Exception calling server fallback function:", e);
              }
            } else {
              console.log("[Auth] pro_documents inserted client-side", { insertedCount: insertedDocs?.length ?? 0 });
            }
          } catch (e) {
            console.error("[Auth] Exception inserting documents via supabase client:", e);
          }
        }
      }
    }
    return data.user?.id ?? null;
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
    if (!verified) throw new Error("Aucun facteur TOTP disponible.");
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

