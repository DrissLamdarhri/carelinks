/**
 * Real-time Yoga Sessions & Enrollments Hook
 * Shared pattern for both mobile and web
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";

type UUID = string;

export type YogaSession = {
  id: UUID;
  title: string;
  description?: string;
  instructor_name?: string;
  level?: string;
  capacity: number;
  price_mad: number;
  starts_at: string;
  duration_min?: number;
  address?: string;
  is_online?: boolean;
  meeting_url?: string;
  created_at?: string;
  image_url?: string;
};

export type YogaEnrollment = {
  session_id: UUID;
  patient_id: UUID;
  enrolled_at?: string;
  enrolled_count?: number; // aggregate
};

type AsyncListState<T> = {
  data: T[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
};

function useAsyncList<T>(
  loader: () => Promise<T[]>,
  deps: React.DependencyList
): AsyncListState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const refresh = useCallback(
    async () => {
      setLoading(true);
      try {
        const rows = await loaderRef.current();
        setData(rows);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, setData, loading, error, refresh };
}

/**
 * Hook to load and subscribe to future yoga sessions
 * Used by patient view
 */
export function useYogaSessions() {
  const { data: sessions, setData: setSessions, loading, error, refresh } =
    useAsyncList<YogaSession>(
      async () => {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("yoga_sessions")
          .select(
            `
            id,
            title,
            description,
            instructor_name,
            level,
            capacity,
            price_mad,
            starts_at,
            duration_min,
            address,
            is_online,
            meeting_url,
            image_url,
            created_at
          `
          )
          .gte("starts_at", now)
          .order("starts_at", { ascending: true });

        if (error) {
          console.error("[useYogaSessions] Supabase error:", error);
          throw error;
        }
        console.log("[useYogaSessions] Loaded sessions:", data?.length ?? 0);
        return (data ?? []) as YogaSession[];
      },
      []
    );

  // Subscribe to changes
  useFocusEffect(
    useCallback(() => {
      const channel = supabase
        .channel(`yoga_sessions:future:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "yoga_sessions",
          },
          () => {
            // Refetch on any change
            void refresh();
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }, [refresh])
  );

  return { sessions, loading, error, refresh };
}

/**
 * Hook to load enrollments for a specific session
 * Used to display current enrollment count
 */
export function useSessionEnrollments(sessionId: UUID | null) {
  const { data: enrollments, setData: setEnrollments, loading, error, refresh } =
    useAsyncList<YogaEnrollment>(
      () =>
        sessionId
          ? Promise.resolve(
              supabase
                .from("yoga_enrollments")
                .select("session_id, patient_id, enrolled_at")
                .eq("session_id", sessionId)
                .then((r) => {
                  if (r.error) throw r.error;
                  return (r.data ?? []) as YogaEnrollment[];
                })
            )
          : Promise.resolve([]),
      [sessionId]
    );

  useFocusEffect(
    useCallback(() => {
      if (!sessionId) return;
      const channel = supabase
        .channel(
          `yoga_enrollments:session:${sessionId}:${Math.random().toString(36).slice(2)}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "yoga_enrollments",
            filter: `session_id=eq.${sessionId}`,
          },
          () => {
            void refresh();
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }, [sessionId, refresh])
  );

  return { enrollments, loading, error, refresh };
}

/**
 * Hook to load all yoga sessions for admin (including past)
 * Admin needs to see all sessions to manage
 */
export function useAllYogaSessions() {
  const { data: sessions, setData: setSessions, loading, error, refresh } =
    useAsyncList<YogaSession>(
      async () => {
        const { data, error } = await supabase
          .from("yoga_sessions")
          .select(
            `
            id,
            title,
            description,
            instructor_name,
            level,
            capacity,
            price_mad,
            starts_at,
            duration_min,
            address,
            is_online,
            meeting_url,
            image_url,
            created_at
          `
          )
          .order("starts_at", { ascending: false });

        if (error) throw error;
        return (data ?? []) as YogaSession[];
      },
      []
    );

  // Subscribe to changes
  useFocusEffect(
    useCallback(() => {
      const channel = supabase
        .channel(`yoga_sessions:all:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "yoga_sessions",
          },
          (payload) => {
            setSessions((prev) => {
              if (payload.eventType === "INSERT") {
                const next = payload.new as YogaSession;
                return [next, ...prev];
              }
              if (payload.eventType === "UPDATE") {
                return prev.map((s) =>
                  s.id === (payload.new as YogaSession).id
                    ? (payload.new as YogaSession)
                    : s
                );
              }
              if (payload.eventType === "DELETE") {
                return prev.filter((s) => s.id !== (payload.old as YogaSession).id);
              }
              return prev;
            });
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }, [setSessions])
  );

  return { sessions, loading, error, refresh };
}
