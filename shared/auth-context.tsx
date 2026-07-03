/**
 * CareLink — React Native–safe AuthContext.
 *
 * Key differences from src/lib/auth-context.tsx (web):
 *   • No localStorage → AsyncStorage / expo-secure-store
 *   • signInWithGoogle → expo-web-browser + makeRedirectUri
 *   • No window.location.origin
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
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Lazy-import expo packages so this file can still be imported in unit tests
// without needing the full Expo environment.
let WebBrowser: typeof import("expo-web-browser") | null = null;
let makeRedirectUri: typeof import("expo-auth-session").makeRedirectUri | null =
  null;

if (Platform.OS !== "web") {
  try {
    WebBrowser = require("expo-web-browser");
    makeRedirectUri = require("expo-auth-session").makeRedirectUri;
    WebBrowser?.maybeCompleteAuthSession?.();
  } catch {
    // expo packages not installed — running in unit test context
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export type UserRole = "patient" | "pro" | "admin" | null;

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
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: (intendedRole?: "patient" | "pro") => Promise<void>;
  signInWithEmail: (
    email: string,
    password: string,
    intendedRole?: "patient" | "pro"
  ) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    fullName: string,
    role: "patient" | "pro",
    options?: { phone?: string; city?: string; profession?: string; services?: string[] }
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  profile: null,
  role: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
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
  if (error || !data) return null;

  const nameParts = (data.full_name ?? "").split(" ");
  return {
    id: data.id,
    role: (data.role === "professional" ? "pro" : data.role) as UserRole,
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" "),
    phone: data.phone ?? "",
    city: data.city ?? "",
    email: "",
    avatar: data.avatar_url ?? "",
    createdAt: data.created_at,
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const role: UserRole = profile?.role ?? null;

  const fetchProfile = async (userId: string) => {
    const p = await fetchProfileFromSupabase(userId);
    if (p) setProfile(p);
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
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
    setProfile(null);
    setUser(null);
    setSession(null);
    await AsyncStorage.removeItem("carelink_intended_role");
  };

  // ── Google OAuth (Expo WebBrowser) ──────────────────────────────────────────
  const signInWithGoogle = async (
    intendedRole: "patient" | "pro" = "patient"
  ) => {
    await AsyncStorage.setItem("carelink_intended_role", intendedRole);

    const redirectTo = makeRedirectUri
      ? makeRedirectUri({ scheme: "ma.carelink.app", path: "auth/callback" })
      : "ma.carelink.app://auth/callback";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
        skipBrowserRedirect: true, // we open the browser ourselves
      },
    });
    if (error) throw error;

    if (data.url && WebBrowser) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );
      if (result.type === "success") {
        // The deep-link handler in _layout.tsx will call
        // supabase.auth.exchangeCodeForSession(code)
      }
    }
  };

  // ── Email/password sign-in ──────────────────────────────────────────────────
  const signInWithEmail = async (
    email: string,
    password: string,
    intendedRole: "patient" | "pro" = "patient"
  ) => {
    await AsyncStorage.setItem("carelink_intended_role", intendedRole);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  // ── Email/password sign-up ──────────────────────────────────────────────────
  const signUpWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    role: "patient" | "pro",
    options?: { phone?: string; city?: string; profession?: string; services?: string[]; experience?: string }
  ) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user) {
      // Create profile row immediately
      await supabase.from("profiles").upsert({
        id: data.user.id,
        role: role === "pro" ? "professional" : "patient",
        full_name: fullName,
        language: "fr",
      });

      if (role === "pro") {
        // Create professional record with profession if provided
        await supabase.from("professionals").upsert({
          id: data.user.id,
          specialty: options?.profession || "nurse",
          years_experience: options?.experience ? parseInt(options.experience) : 0,
        });
      }
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
        refreshProfile,
        signOut: handleSignOut,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
