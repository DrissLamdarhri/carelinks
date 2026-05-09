/**
 * CareLink – Multi-role Auth Context
 * Wraps Supabase Auth and augments session with our KV user profile.
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getUser } from "./api";

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
  // For admin (non-Supabase token stored in localStorage)
  isAdminAuthed: boolean;
  setAdminAuthed: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, session: null, profile: null, role: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
  signInWithGoogle: async () => {},
  isAdminAuthed: false,
  setAdminAuthed: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminAuthed, setAdminAuthed] = useState(() => {
    return localStorage.getItem("carelink_admin_authed") === "true";
  });

  const role: UserRole = profile?.role ?? null;

  const fetchProfile = async (userId: string) => {
    try {
      const data = await getUser(userId);
      if (data?.user) setProfile(data.user);
    } catch (err) {
      console.log("fetchProfile error:", err);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await fetchProfile(newSession.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem("carelink_admin_authed", isAdminAuthed ? "true" : "false");
  }, [isAdminAuthed]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const signInWithGoogle = async (intendedRole: "patient" | "pro" = "patient") => {
    localStorage.setItem("carelink_intended_role", intendedRole);
    const redirectTo = `${window.location.origin}${intendedRole === "pro" ? "/nurse" : "/app"}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, role, loading,
      refreshProfile,
      signOut: handleSignOut,
      signInWithGoogle,
      isAdminAuthed, setAdminAuthed,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
