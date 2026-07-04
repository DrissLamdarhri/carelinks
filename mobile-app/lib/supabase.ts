import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const SUPABASE_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL as string) ??
  "https://wjhzrovmktekfcjohhrw.supabase.co";

const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHpyb3Zta3Rla2Zjam9oaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjIyNjIsImV4cCI6MjA5MzA5ODI2Mn0.9JBvgWZVxrxsWMkniVI-MBt84SashdVRq_6tMnfaGYQ";

type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const memoryStorage = new Map<string, string>();

const webFallbackStorage: AuthStorage = {
  getItem: async (key: string) => memoryStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memoryStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    memoryStorage.delete(key);
  },
};

const authStorage: AuthStorage =
  Platform.OS === "web"
    ? typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : webFallbackStorage
    : AsyncStorage;

let _supabase: SupabaseClient | null = null;

function validateSupabaseEnv() {
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn("[Supabase] EXPO_PUBLIC_SUPABASE_ANON_KEY not set — using bundled fallback key.");
  }
  if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === "******" || SUPABASE_ANON_KEY.length < 20) {
    const msg =
      "EXPO_PUBLIC_SUPABASE_ANON_KEY is not set or looks invalid. Set EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment (expo start) to your Supabase anon/public key.";
    console.error(msg);
    throw new Error(msg);
  }
}

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    validateSupabaseEnv();
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  }
  return _supabase;
}

export const supabase = getSupabase();
