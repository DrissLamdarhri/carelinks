// import { useCallback, useEffect, useRef, useState } from "react";
// import { useFocusEffect } from "expo-router";
// import { supabase } from "@/lib/supabase";
// // import { db } from "./dal";
// import type { Bid, Booking, Message, ProSpecialty, UUID } from "./types";

// type AsyncListState<T> = {
//   data: T[];
//   loading: boolean;
//   error: Error | null;
//   refresh: () => Promise<void>;
//   setData: React.Dispatch<React.SetStateAction<T[]>>;
// };

// function useAsyncList<T>(loader: () => Promise<T[]>, deps: React.DependencyList): AsyncListState<T> {
//   const [data, setData] = useState<T[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<Error | null>(null);
//   const loaderRef = useRef(loader);
//   loaderRef.current = loader;

//   const refresh = useCallback(async () => {
//     setLoading(true);
//     try {
//       const rows = await loaderRef.current();
//       setData(rows);
//       setError(null);
//     } catch (err) {
//       setError(err as Error);
//     } finally {
//       setLoading(false);
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, deps);

//   useEffect(() => {
//     refresh();
//   }, [refresh]);

//   return { data, setData, loading, error, refresh };
// }

// export function useBookingBids(bookingId: UUID | null) {
// //   const { data, setData, loading, error, refresh } = useAsyncList<Bid>(
//     () => (bookingId && !isDemo ? db.bids.listForBooking(bookingId) : Promise.resolve([])),
//     [bookingId, isDemo]
//   );

//   useFocusEffect(
//     useCallback(() => {
//       // Skip realtime subscription for demo bookings
//       if (!bookingId) return;

//       const channel = supabase
//         .channel(`bids:booking:${bookingId}:${Math.random().toString(36).slice(2)}`)
//         .on(
//           "postgres_changes",
//           {
//             event: "*",
//             schema: "public",
//             table: "bids",
//             filter: `booking_id=eq.${bookingId}`,
//           },
//           (payload) => {
//             setData((prev) => {
//               if (payload.eventType === "INSERT") {
//                 return [...prev, payload.new as Bid].sort((a, b) => a.price_mad - b.price_mad);
//               }
//               if (payload.eventType === "UPDATE") {
//                 return prev.map((row) => (row.id === (payload.new as Bid).id ? (payload.new as Bid) : row));
//               }
//               if (payload.eventType === "DELETE") {
//                 return prev.filter((row) => row.id !== (payload.old as Bid).id);
//               }
//               return prev;
//             });
//           }
//         )
//         .subscribe();
//       return () => {
//         void supabase.removeChannel(channel);
//       };
//     }, [bookingId, setData])
//   );

//   const pendingBids = data.filter((item) => item.status === "pending");
//   return { bids: data, pendingBids, loading, error, refresh };
// }

// export function usePatientBookings(patientId: UUID | null) {
//   const { data, setData, loading, error, refresh } = useAsyncList<Booking>(
//     () => (patientId ? db.bookings.listForPatient(patientId) : Promise.resolve([])),
//     [patientId]
//   );

//   useFocusEffect(
//     useCallback(() => {
//       if (!patientId) return;
//       const channel = supabase
//         .channel(`bookings:patient:${patientId}:${Math.random().toString(36).slice(2)}`)
//         .on(
//           "postgres_changes",
//           {
//             event: "*",
//             schema: "public",
//             table: "bookings",
//             filter: `patient_id=eq.${patientId}`,
//           },
//           (payload) => {
//             setData((prev) => {
//               if (payload.eventType === "INSERT") return [payload.new as Booking, ...prev];
//               if (payload.eventType === "UPDATE") {
//                 return prev.map((row) => (row.id === (payload.new as Booking).id ? (payload.new as Booking) : row));
//               }
//               if (payload.eventType === "DELETE") {
//                 return prev.filter((row) => row.id !== (payload.old as Booking).id);
//               }
//               return prev;
//             });
//           }
//         )
//         .subscribe();
//       return () => {
//         void supabase.removeChannel(channel);
//       };
//     }, [patientId, setData])
//   );

//   return { bookings: data, loading, error, refresh };
// }

// export function useOpenBookingsBySpecialty(specialty: ProSpecialty | null) {
//   const { data, setData, loading, error, refresh } = useAsyncList<Booking>(
//     () => (specialty ? db.bookings.listOpenForSpecialty(specialty) : Promise.resolve([])),
//     [specialty]
//   );

//   useFocusEffect(
//     useCallback(() => {
//       if (!specialty) return;
//       const channel = supabase
//         .channel(`bookings:specialty:${specialty}:${Math.random().toString(36).slice(2)}`)
//         .on(
//           "postgres_changes",
//           {
//             event: "*",
//             schema: "public",
//             table: "bookings",
//             filter: `specialty=eq.${specialty}`,
//           },
//           (payload) => {
//             setData((prev) => {
//               if (payload.eventType === "INSERT") {
//                 const next = payload.new as Booking;
//                 return next.status === "open" ? [next, ...prev] : prev;
//               }
//               if (payload.eventType === "UPDATE") {
//                 const next = payload.new as Booking;
//                 if (next.status !== "open") {
//                   return prev.filter((row) => row.id !== next.id);
//                 }
//                 const exists = prev.some((row) => row.id === next.id);
//                 return exists ? prev.map((row) => (row.id === next.id ? next : row)) : [next, ...prev];
//               }
//               if (payload.eventType === "DELETE") {
//                 return prev.filter((row) => row.id !== (payload.old as Booking).id);
//               }
//               return prev;
//             });
//           }
//         )
//         .subscribe();
//       return () => {
//         void supabase.removeChannel(channel);
//       };
//     }, [specialty, setData])
//   );

//   return { bookings: data, loading, error, refresh };
// }

// export function useBookingMessages(bookingId: UUID | null) {
// //   const { data, setData, loading, error, refresh } = useAsyncList<Message>(
//     () => (bookingId && !isDemo ? db.messages.listForBooking(bookingId) : Promise.resolve([])),
//     [bookingId, isDemo]
//   );

//   useFocusEffect(
//     useCallback(() => {
//       // Skip realtime subscription for demo bookings
//       if (!bookingId) return;

//       const channel = supabase
//         .channel(`messages:booking:${bookingId}:${Math.random().toString(36).slice(2)}`)
//         .on(
//           "postgres_changes",
//           {
//             event: "INSERT",
//             schema: "public",
//             table: "messages",
//             filter: `booking_id=eq.${bookingId}`,
//           },
//           (payload) => {
//             setData((prev) => {
//               const next = payload.new as Message;
//               if (prev.some((row) => row.id === next.id)) return prev;
//               return [...prev, next];
//             });
//           }
//         )
//         .subscribe();
//       return () => {
//         void supabase.removeChannel(channel);
//       };
//     }, [bookingId, setData])
//   );

//   return { messages: data, setMessages: setData, loading, error, refresh };
// }
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { db } from "./dal";
import type { Bid, Booking, Message, OpenDemand, ProSpecialty, UUID } from "./types";

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
  const { data, setData, loading, error, refresh } = useAsyncList<Bid>(
    () => (bookingId ? db.bids.listForBooking(bookingId) : Promise.resolve([])),
    [bookingId]
  );

  useFocusEffect(
    useCallback(() => {
      // Skip realtime subscription for demo bookings
      if (!bookingId) return;

      const channel = supabase
        .channel(`bids:booking:${bookingId}:${Math.random().toString(36).slice(2)}`)
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
    }, [bookingId, setData])
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
        .channel(`bookings:patient:${patientId}:${Math.random().toString(36).slice(2)}`)
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

// Scoped to a single window (a calendar week) instead of the patient's entire
// history — what patient/bookings.tsx uses now so the appointments list stops
// getting slower as history piles up. usePatientBookings above stays
// unbounded on purpose: patient/messages.tsx needs full history to group
// conversations correctly across every booking ever shared with a pro.
export function usePatientBookingsWindow(patientId: UUID | null, startISO: string, endISO: string) {
  const { data, loading, error, refresh } = useAsyncList<Booking>(
    () => (patientId ? db.bookings.listForPatientInWindow(patientId, startISO, endISO) : Promise.resolve([])),
    [patientId, startISO, endISO]
  );

  // The window is small, so a wholesale refetch on any change is cheap and
  // avoids having to reason about whether a patched-in row still belongs to
  // the currently-visible window.
  useFocusEffect(
    useCallback(() => {
      if (!patientId) return;
      const channel = supabase
        .channel(`bookings:patient-window:${patientId}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings", filter: `patient_id=eq.${patientId}` },
          () => void refresh()
        )
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    }, [patientId, refresh])
  );

  return { bookings: data, loading, error, refresh };
}

// Same idea for the pro side — pro/schedule.tsx used to fetch every mission a
// pro had ever had (unbounded, rendered as one long list). Scoped to a
// calendar week instead, so the screen stays fast no matter how long a pro
// has been active.
export function useProBookingsWindow(proId: UUID | null, startISO: string, endISO: string) {
  const { data, loading, error, refresh } = useAsyncList<Booking>(
    () => (proId ? db.bookings.listForProInWindow(proId, startISO, endISO) : Promise.resolve([])),
    [proId, startISO, endISO]
  );

  useFocusEffect(
    useCallback(() => {
      if (!proId) return;
      const channel = supabase
        .channel(`bookings:pro-window:${proId}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings", filter: `professional_id=eq.${proId}` },
          () => void refresh()
        )
        .subscribe();
      return () => { void supabase.removeChannel(channel); };
    }, [proId, refresh])
  );

  return { bookings: data, loading, error, refresh };
}

// ─── Professional: open bookings by specialty ─────────────────────────────────

export interface UseOpenBookingsBySpecialtyOpts {
  /**
   * Called once for every new redacted demand that appears in the feed.
   * Use this to fire push notifications or update a badge count on the pro side.
   * The callback is stored in a ref so changing it never re-triggers the subscription.
   */
  onNewDemand?: (demand: OpenDemand) => void;
}

export function useOpenBookingsBySpecialty(
  specialty: ProSpecialty | null,
  opts?: UseOpenBookingsBySpecialtyOpts
) {
  const { data, setData, loading, error, refresh } = useAsyncList<OpenDemand>(
    () => (specialty ? db.bookings.listOpenForSpecialty(specialty) : Promise.resolve([])),
    [specialty]
  );

  // Keep the callback in a ref so the subscription effect never stale-closes over it.
  const onNewDemandRef = useRef(opts?.onNewDemand);
  useEffect(() => {
    onNewDemandRef.current = opts?.onNewDemand;
  });

  useFocusEffect(
    useCallback(() => {
      if (!specialty) return;
      // Subscribed to `open_demands` rather than `bookings`: the demand feed is
      // the redacted projection (migration 0028), so a realtime payload can no
      // longer carry a patient's address. A row exists there only while the
      // request is open, which is why leaving `open` arrives here as a DELETE.
      const channel = supabase
        .channel(`demands:specialty:${specialty}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "open_demands",
            filter: `specialty=eq.${specialty}`,
          },
          (payload) => {
            setData((prev) => {
              if (payload.eventType === "INSERT") {
                const next = payload.new as OpenDemand;
                // Notify the professional about the new demand (push + bell row).
                onNewDemandRef.current?.(next);
                return [next, ...prev];
              }
              if (payload.eventType === "UPDATE") {
                const next = payload.new as OpenDemand;
                const exists = prev.some((row) => row.booking_id === next.booking_id);
                return exists
                  ? prev.map((row) => (row.booking_id === next.booking_id ? next : row))
                  : [next, ...prev];
              }
              if (payload.eventType === "DELETE") {
                const gone = payload.old as OpenDemand;
                return prev.filter((row) => row.booking_id !== gone.booking_id);
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
  const { data, setData, loading, error, refresh } = useAsyncList<Message>(
    () => (bookingId ? db.messages.listForBooking(bookingId) : Promise.resolve([])),
    [bookingId]
  );

  useFocusEffect(
    useCallback(() => {
      // Skip realtime subscription for demo bookings
      if (!bookingId) return;

      const channel = supabase
        .channel(`messages:booking:${bookingId}:${Math.random().toString(36).slice(2)}`)
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
    }, [bookingId, setData])
  );

  return { messages: data, setMessages: setData, loading, error, refresh };
}