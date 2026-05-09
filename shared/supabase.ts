/**
 * CareLink — React Native–safe Supabase client.
 *
 * Key differences from the web version (src/lib/supabase.ts):
 *   • storage  → AsyncStorage instead of localStorage
 *   • detectSessionInUrl → false  (RN has no URL bar)
 *   • URL / anon key read from EXPO_PUBLIC_* env vars
 *
 * In the web admin portal, keep using src/lib/supabase.ts unchanged.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Env vars injected by Expo (prefix EXPO_PUBLIC_ is mandatory for client-side)
const SUPABASE_URL =
  (process.env.EXPO_PUBLIC_SUPABASE_URL as string) ??
  "https://wjhzrovmktekfcjohhrw.supabase.co";

const SUPABASE_ANON_KEY =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string) ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqaHpyb3Zta3Rla2Zjam9oaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjIyNjIsImV4cCI6MjA5MzA5ODI2Mn0.9JBvgWZVxrxsWMkniVI-MBt84SashdVRq_6tMnfaGYQ";

let _client: SupabaseClient | null = null;

type AuthStorage = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

const inMemoryStorage = new Map<string, string>();

const serverSafeWebStorage: AuthStorage = {
  getItem: async (key: string) => inMemoryStorage.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    inMemoryStorage.set(key, value);
  },
  removeItem: async (key: string) => {
    inMemoryStorage.delete(key);
  },
};

const authStorage: AuthStorage =
  Platform.OS === "web"
    ? typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : serverSafeWebStorage
    : AsyncStorage;

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // AsyncStorage persists the session in the device keychain area
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        // IMPORTANT: must be false in React Native — no URL bar to detect
        detectSessionInUrl: false,
        // PKCE flow is supported and recommended for mobile
        flowType: "pkce",
      },
    });
  }
  return _client;
}

export const supabase = getSupabase();
