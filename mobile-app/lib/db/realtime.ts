import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { isDemoBookingId } from "@/lib/demo-booking";
import { db } from "./dal";
import type { Bid, Booking, Message, ProSpecialty, UUID } from "./types";

type AsyncListState<T> = {
  data: T[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
};

function useAsyncList<T>(loader: () => Promise<T[]>, deps: React.DependencyList): AsyncListState<T> {
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
    } catch (err) {
      setError(err as Error);
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

export function useBookingBids(bookingId: UUID | null) {
  const isDemo = isDemoBookingId(bookingId);
  const { data, setData, loading, error, refresh } = useAsyncList<Bid>(
    () => (bookingId && !isDemo ? db.bids.listForBooking(bookingId) : Promise.resolve([])),
    [bookingId, isDemo]
  );

  useFocusEffect(
    useCallback(() => {
      // Skip realtime subscription for demo bookings
      if (!bookingId || isDemo) return;

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
                return [...prev, payload.new as Bid].sort((a, b) => a.price_mad - b.price_mad);
              }
              if (payload.eventType === "UPDATE") {
                return prev.map((row) => (row.id === (payload.new as Bid).id ? (payload.new as Bid) : row));
              }
              if (payload.eventType === "DELETE") {
                return prev.filter((row) => row.id !== (payload.old as Bid).id);
              }
              return prev;
            });
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [bookingId, isDemo, setData])
  );

  const pendingBids = data.filter((item) => item.status === "pending");
  return { bids: data, pendingBids, loading, error, refresh };
}

export function usePatientBookings(patientId: UUID | null) {
  const { data, setData, loading, error, refresh } = useAsyncList<Booking>(
    () => (patientId ? db.bookings.listForPatient(patientId) : Promise.resolve([])),
    [patientId]
  );

  useFocusEffect(
    useCallback(() => {
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
              if (payload.eventType === "INSERT") return [payload.new as Booking, ...prev];
              if (payload.eventType === "UPDATE") {
                return prev.map((row) => (row.id === (payload.new as Booking).id ? (payload.new as Booking) : row));
              }
              if (payload.eventType === "DELETE") {
                return prev.filter((row) => row.id !== (payload.old as Booking).id);
              }
              return prev;
            });
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [patientId, setData])
  );

  return { bookings: data, loading, error, refresh };
}

export function useOpenBookingsBySpecialty(specialty: ProSpecialty | null) {
  const { data, setData, loading, error, refresh } = useAsyncList<Booking>(
    () => (specialty ? db.bookings.listOpenForSpecialty(specialty) : Promise.resolve([])),
    [specialty]
  );

  useFocusEffect(
    useCallback(() => {
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
              if (payload.eventType === "INSERT") {
                const next = payload.new as Booking;
                return next.status === "open" ? [next, ...prev] : prev;
              }
              if (payload.eventType === "UPDATE") {
                const next = payload.new as Booking;
                if (next.status !== "open") {
                  return prev.filter((row) => row.id !== next.id);
                }
                const exists = prev.some((row) => row.id === next.id);
                return exists ? prev.map((row) => (row.id === next.id ? next : row)) : [next, ...prev];
              }
              if (payload.eventType === "DELETE") {
                return prev.filter((row) => row.id !== (payload.old as Booking).id);
              }
              return prev;
            });
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [specialty, setData])
  );

  return { bookings: data, loading, error, refresh };
}

export function useBookingMessages(bookingId: UUID | null) {
  const isDemo = isDemoBookingId(bookingId);
  const { data, setData, loading, error, refresh } = useAsyncList<Message>(
    () => (bookingId && !isDemo ? db.messages.listForBooking(bookingId) : Promise.resolve([])),
    [bookingId, isDemo]
  );

  useFocusEffect(
    useCallback(() => {
      // Skip realtime subscription for demo bookings
      if (!bookingId || isDemo) return;

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
              const next = payload.new as Message;
              if (prev.some((row) => row.id === next.id)) return prev;
              return [...prev, next];
            });
          }
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    }, [bookingId, isDemo, setData])
  );

  return { messages: data, setMessages: setData, loading, error, refresh };
}
