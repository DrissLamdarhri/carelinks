// CareLink — React hooks for Supabase Realtime subscriptions.
// All hooks subscribe to postgres_changes on the tables defined in schema.sql.

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import { db } from "./dal";
import type {
  Bid,
  Booking,
  Message,
  Notification,
  ProSpecialty,
  UUID,
} from "./types";

// ── Generic async-list hook ───────────────────────────────────────────────────
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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await loaderRef.current();
      setData(rows);
      setError(null);
    } catch (e) {
      console.error("useAsyncList error:", e);
      setError(e as Error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, setData, loading, error, refresh };
}

// ══════════════════════════════════════════════════════════════════════════════
// useBookingBids — patient watches incoming bids on their booking (real-time)
// ══════════════════════════════════════════════════════════════════════════════
export function useBookingBids(bookingId: UUID | null) {
  const { data, setData, loading, error, refresh } = useAsyncList<Bid>(
    () =>
      bookingId
        ? db.bids.listForBooking(bookingId)
        : Promise.resolve([]),
    [bookingId]
  );

  useEffect(() => {
    if (!bookingId) return;
    const channel = supabase
      .channel(`bids:booking:${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bids",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          setData((prev) => {
            if (payload.eventType === "INSERT") {
              return [...prev, payload.new as Bid].sort(
                (a, b) => a.price_mad - b.price_mad
              );
            }
            if (payload.eventType === "UPDATE") {
              return prev
                .map((b) =>
                  b.id === (payload.new as Bid).id ? (payload.new as Bid) : b
                )
                .sort((a, b) => a.price_mad - b.price_mad);
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((b) => b.id !== (payload.old as Bid).id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, setData]);

  const pendingBids = data.filter((b) => b.status === "pending");
  return { bids: data, pendingBids, loading, error, refresh };
}

// ══════════════════════════════════════════════════════════════════════════════
// usePatientBookings — patient's own booking list (real-time)
// ══════════════════════════════════════════════════════════════════════════════
export function usePatientBookings(patientId: UUID | null) {
  const { data, setData, loading, error, refresh } = useAsyncList<Booking>(
    () =>
      patientId
        ? db.bookings.listForPatient(patientId)
        : Promise.resolve([]),
    [patientId]
  );

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`bookings:patient:${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `patient_id=eq.${patientId}`,
        },
        (payload) => {
          setData((prev) => {
            if (payload.eventType === "INSERT")
              return [payload.new as Booking, ...prev];
            if (payload.eventType === "UPDATE")
              return prev.map((b) =>
                b.id === (payload.new as Booking).id
                  ? (payload.new as Booking)
                  : b
              );
            if (payload.eventType === "DELETE")
              return prev.filter(
                (b) => b.id !== (payload.old as Booking).id
              );
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, setData]);

  const upcoming = data.filter((b) =>
    ["open", "matched", "in_progress"].includes(b.status)
  );
  const past = data.filter((b) =>
    ["completed", "cancelled"].includes(b.status)
  );

  return { bookings: data, upcoming, past, loading, error, refresh };
}

// ══════════════════════════════════════════════════════════════════════════════
// useOpenBookingsBySpecialty — pro's real-time feed of open bookings
// ══════════════════════════════════════════════════════════════════════════════
export function useOpenBookingsBySpecialty(
  specialty: ProSpecialty | null
) {
  const { data, setData, loading, error, refresh } = useAsyncList<Booking>(
    () =>
      specialty
        ? db.bookings.listOpenForSpecialty(specialty)
        : Promise.resolve([]),
    [specialty]
  );

  useEffect(() => {
    if (!specialty) return;
    const channel = supabase
      .channel(`bookings:specialty:${specialty}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `specialty=eq.${specialty}`,
        },
        (payload) => {
          setData((prev) => {
            const isOpen = (b: Booking) => b.status === "open";
            if (payload.eventType === "INSERT") {
              const row = payload.new as Booking;
              return isOpen(row) ? [row, ...prev] : prev;
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as Booking;
              const exists = prev.some((b) => b.id === row.id);
              if (!isOpen(row)) return prev.filter((b) => b.id !== row.id);
              return exists
                ? prev.map((b) => (b.id === row.id ? row : b))
                : [row, ...prev];
            }
            if (payload.eventType === "DELETE") {
              return prev.filter(
                (b) => b.id !== (payload.old as Booking).id
              );
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [specialty, setData]);

  return { bookings: data, loading, error, refresh };
}

// ══════════════════════════════════════════════════════════════════════════════
// useBookingMessages — real-time chat on a booking
// ══════════════════════════════════════════════════════════════════════════════
export function useBookingMessages(bookingId: UUID | null) {
  const { data, setData, loading, error, refresh } = useAsyncList<Message>(
    () =>
      bookingId
        ? db.messages.listForBooking(bookingId)
        : Promise.resolve([]),
    [bookingId]
  );

  useEffect(() => {
    if (!bookingId) return;
    const channel = supabase
      .channel(`messages:booking:${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          setData((prev) => {
            // Avoid duplicates (optimistic insert)
            const msg = payload.new as Message;
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, setData]);

  return { messages: data, setMessages: setData, loading, error, refresh };
}

// ══════════════════════════════════════════════════════════════════════════════
// useUserNotifications — real-time notification bell
// ══════════════════════════════════════════════════════════════════════════════
export function useUserNotifications(userId: UUID | null) {
  const { data, setData, loading, error, refresh } =
    useAsyncList<Notification>(
      () =>
        userId
          ? db.notifications.listForUser(userId)
          : Promise.resolve([]),
      [userId]
    );

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setData((prev) => {
            if (payload.eventType === "INSERT")
              return [payload.new as Notification, ...prev];
            if (payload.eventType === "UPDATE")
              return prev.map((n) =>
                n.id === (payload.new as Notification).id
                  ? (payload.new as Notification)
                  : n
              );
            if (payload.eventType === "DELETE")
              return prev.filter(
                (n) => n.id !== (payload.old as Notification).id
              );
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, setData]);

  const unreadCount = data.filter((n) => !n.is_read).length;

  return { notifications: data, unreadCount, loading, error, refresh };
}
