/**
 * CareLink — the professional's live position while en route.
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AS A BACKGROUND TASK
 *
 * Tracking used to run on `Location.watchPositionAsync` inside a mounted React
 * component. That is foreground-only: the instant the pro locked their phone,
 * took a call, or switched to Maps, the GPS watch was suspended and the
 * patient's screen froze on the last fix — with no indication it had gone
 * stale. A pro driving across town with their phone in a pocket transmitted
 * nothing at all. That is not a tracking feature.
 *
 * `startLocationUpdatesAsync` + a TaskManager task keeps delivering while
 * backgrounded: an Android foreground service (with the persistent notification
 * the platform requires — the pro can always see they're sharing) and the iOS
 * `location` background mode.
 *
 * ONE WRITER. The task is the only thing that publishes a position: it
 * broadcasts on the booking's realtime channel, persists a throttled
 * last-known point to Postgres, and notifies in-process listeners so the pro's
 * own map updates too. Screens never watch GPS themselves — two writers on one
 * channel is how you get positions arriving out of order.
 */
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { tracking, proStreamTopic } from "@/lib/db/tracking";

export const LIVE_LOCATION_TASK = "carelink-live-location";

/** Survives process death: a headless task relaunch has no React state. */
const SESSION_KEY = "carelink.live-location.session";

/** Persist the last-known point at most this often (ms) — realtime carries the
 *  live stream; the DB write only has to be good enough to seed a cold start. */
const PERSIST_EVERY_MS = 15_000;
/** …or sooner if they've moved this far since the last write (km). */
const PERSIST_EVERY_KM = 0.1;

export type LivePosition = {
  lat: number;
  lng: number;
  at: string;
  /** GPS course-over-ground (deg). Null unless actually moving — see below. */
  heading: number | null;
  /** m/s. */
  speed: number | null;
  /**
   * Monotonic per-session counter. Realtime does not guarantee ordering, and a
   * packet that arrives late must never drag the marker backwards — receivers
   * drop anything with a seq lower than the highest already seen.
   */
  seq: number;
  /** Reported GPS accuracy in metres; receivers reject implausible fixes. */
  accuracy: number | null;
};

/** Persisted across process death so a headless relaunch knows which trip it
 *  is publishing for. The professional's identity is deliberately NOT stored:
 *  the server derives it from the authenticated caller on every write. */
type Session = { bookingId: string };

// ── In-process fan-out (the pro's own map) ──────────────────────────────────
const listeners = new Set<(p: LivePosition) => void>();

/** Subscribe to positions produced by the task. Returns an unsubscribe fn. */
export function onLivePosition(fn: (p: LivePosition) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// ── Module-owned broadcast channel ──────────────────────────────────────────
let channel: RealtimeChannel | null = null;
let channelTopic: string | null = null;

function channelFor(bookingId: string): RealtimeChannel {
  const topic = proStreamTopic(bookingId);
  if (channel && channelTopic === topic) return channel;
  if (channel) void supabase.removeChannel(channel);
  // PRIVATE channel: the server checks `can_send_pro_stream()` (migration 0052)
  // before accepting a single broadcast. A build that tried to publish before
  // the nurse pressed "Je pars", or after the visit ended, is refused by
  // Postgres — the lifecycle is not enforceable here and is not trusted here.
  channel = supabase.channel(topic, { config: { private: true } });
  channelTopic = topic;
  void channel.subscribe();
  return channel;
}

function releaseChannel() {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
  channelTopic = null;
}

// ── Throttled persistence ───────────────────────────────────────────────────
let lastPersistAt = 0;
let lastPersisted: { lat: number; lng: number } | null = null;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Per-session broadcast counter (reset in startLiveLocation). */
let seq = 0;

function toPosition(loc: Location.LocationObject): LivePosition {
  // `coords.heading` is garbage while stationary (it reports -1, or drifts
  // wildly as the magnetometer settles). Only trust it above a walking pace,
  // otherwise the arrow spins on a parked phone.
  const speed = loc.coords.speed ?? null;
  const moving = (speed ?? 0) > 0.4; // ~1.5 km/h
  const heading = loc.coords.heading;
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    at: new Date(loc.timestamp || Date.now()).toISOString(),
    heading: moving && heading != null && heading >= 0 ? heading : null,
    speed,
    seq: ++seq,
    accuracy: loc.coords.accuracy ?? null,
  };
}

async function publish(locations: Location.LocationObject[]) {
  const latest = locations[locations.length - 1];
  if (!latest) return;

  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return; // no active trip — a stale task tick, ignore it
  let session: Session;
  try {
    session = JSON.parse(raw) as Session;
  } catch {
    return;
  }
  if (!session.bookingId) return;

  const position = toPosition(latest);

  // 1. The pro's own screen (only alive when foregrounded — harmless otherwise).
  listeners.forEach((fn) => {
    try {
      fn(position);
    } catch {
      /* a broken listener must never kill the broadcast */
    }
  });

  // 2. The patient, live.
  try {
    await channelFor(session.bookingId).send({
      type: "broadcast",
      event: "position",
      payload: position,
    });
  } catch {
    /* transient socket failure — the next fix (1-2s) retries */
  }

  // 3. Last-known, throttled, so a patient opening the app cold sees the nurse
  //    immediately instead of a blank map.
  //
  //    This is a SINGLE MUTABLE ROW per session, not an append-only ping log.
  //    At ~1.5 s per fix, a few thousand concurrent trips would mean hundreds
  //    of inserts per second, forever, for data whose only consumer is "where
  //    was the nurse when I opened the app". Realtime broadcast carries the
  //    live stream and never touches Postgres; this write is the cold-start
  //    seed and nothing more.
  //
  //    It is also session-scoped now. It used to write the pro's GLOBAL
  //    profile location (`set_pro_location` → `v_pros_public`), which conflated
  //    "where this professional advertises themselves" with "where they are
  //    during this specific visit", and leaked trip movement into a view other
  //    patients can read.
  const movedFar = lastPersisted != null && distanceKm(lastPersisted, position) >= PERSIST_EVERY_KM;
  if (lastPersisted != null && !movedFar && Date.now() - lastPersistAt < PERSIST_EVERY_MS) return;
  lastPersistAt = Date.now();
  lastPersisted = { lat: position.lat, lng: position.lng };
  try {
    await tracking.updatePosition({
      bookingId: session.bookingId,
      lat: position.lat,
      lng: position.lng,
      heading: position.heading,
      speed: position.speed,
      seq: position.seq,
    });
  } catch {
    /* best-effort: realtime is the live path, this is only the cold-start seed */
  }
}

// ── The task itself ─────────────────────────────────────────────────────────
// Defined at module scope: the OS can relaunch the app headless straight into
// this task, so registration must not depend on any component having mounted.
TaskManager.defineTask(LIVE_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  if (!locations?.length) return;
  await publish(locations);
});

// ── Start / stop ────────────────────────────────────────────────────────────
/** Foreground-only fallback used when background updates can't be started. */
let fallbackWatch: Location.LocationSubscription | null = null;

export type StartResult =
  | { ok: true; background: boolean }
  | { ok: false; reason: "permission-denied" | "failed" };

/**
 * Begin publishing the pro's position for `bookingId`.
 * Idempotent: calling it again for the same trip is a no-op.
 */
export async function startLiveLocation(bookingId: string): Promise<StartResult> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return { ok: false, reason: "permission-denied" };

  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ bookingId } satisfies Session));
  lastPersistAt = 0;
  lastPersisted = null;
  seq = 0;
  channelFor(bookingId); // open the socket now, not on the first fix

  // Background permission is requested but NOT required: on Android the
  // foreground service keeps updates flowing without it, and on iOS the pro
  // still gets full accuracy while the app is open. Degrade, never block.
  let background = false;
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    background = bg.granted;
  } catch {
    background = false;
  }

  try {
    const already = await TaskManager.isTaskRegisteredAsync(LIVE_LOCATION_TASK);
    if (already) await Location.stopLocationUpdatesAsync(LIVE_LOCATION_TASK).catch(() => {});

    await Location.startLocationUpdatesAsync(LIVE_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 2000,
      distanceInterval: 5,
      // Deliver every fix as it lands — batching would reintroduce exactly the
      // lag this whole change exists to remove.
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "CareLink — trajet en cours",
        notificationBody: "Votre position est partagée avec le patient.",
        notificationColor: "#0D0870",
        killServiceOnDestroy: false,
      },
    });
    stopFallbackWatch();
    return { ok: true, background };
  } catch {
    // Background updates unavailable (unsupported device, service blocked by a
    // battery optimiser, missing config in a stale build). A foreground-only
    // watch is degraded but far better than a frozen dot.
    const started = await startFallbackWatch();
    return started ? { ok: true, background: false } : { ok: false, reason: "failed" };
  }
}

async function startFallbackWatch(): Promise<boolean> {
  if (fallbackWatch) return true;
  try {
    fallbackWatch = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
      (loc) => {
        void publish([loc]);
      },
    );
    return true;
  } catch {
    return false;
  }
}

function stopFallbackWatch() {
  fallbackWatch?.remove();
  fallbackWatch = null;
}

/** Stop publishing. Safe to call when nothing is running. */
export async function stopLiveLocation(): Promise<void> {
  stopFallbackWatch();
  await AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  try {
    if (await TaskManager.isTaskRegisteredAsync(LIVE_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(LIVE_LOCATION_TASK);
    }
  } catch {
    /* already stopped */
  }
  releaseChannel();
}

/**
 * Clear a session left behind by a crash or a force-quit mid-trip — otherwise
 * the foreground service notification can outlive the trip and the pro keeps
 * broadcasting to a booking that finished yesterday. Called once at startup.
 */
export async function reconcileLiveLocationOnStartup(): Promise<void> {
  const raw = await AsyncStorage.getItem(SESSION_KEY).catch(() => null);
  if (!raw) {
    // No session, but the OS may still hold a registered task from a killed run.
    try {
      if (await TaskManager.isTaskRegisteredAsync(LIVE_LOCATION_TASK)) {
        await Location.stopLocationUpdatesAsync(LIVE_LOCATION_TASK);
      }
    } catch {
      /* nothing to clean */
    }
    return;
  }
  let session: Session;
  try {
    session = JSON.parse(raw) as Session;
  } catch {
    await stopLiveLocation();
    return;
  }
  // The session row is the authority, not the booking status and certainly not
  // whatever this device last believed. If the server says the session is not
  // active, we stop — even if the phone thinks a trip is in progress.
  try {
    const row = await tracking.get(session.bookingId);
    if (row?.status !== "active") await stopLiveLocation();
  } catch {
    /* offline at boot — leave it; the tracking screen reconciles on open, and
       the server would refuse our broadcasts anyway if the session had ended */
  }
}
