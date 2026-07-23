import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import type { NearbyPro } from "./types";

/** Real approved professional with coordinates, ready to plot on the map. */
export type NearbyProMapItem = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialty: string;
  rating_avg: number | null;
  hourly_rate_mad: number | null;
  lat: number;
  lng: number;
  distanceKm: number;
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Google "Plus Code" (Open Location Code) detector, e.g. "3X58+Q4P".
 * These leak out of Android reverse-geocoding and are meaningless to users.
 */
export function isPlusCode(v: string): boolean {
  return /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i.test(v.trim());
}

/**
 * Presentation helper for any stored address: removes Plus-Code fragments and
 * tidies leftover separators, so old rows like "3X58+Q4P, Fès" render as "Fès".
 * Returns "" when nothing meaningful remains (callers fall back to a label).
 */
export function formatAddress(address?: string | null): string {
  if (!address) return "";
  const cleaned = address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isPlusCode(part))
    .join(", ");
  return cleaned.replace(/\s{2,}/g, " ").replace(/^[,\s]+|[,\s]+$/g, "");
}

export const geo = {
  async setProLocation(proId: string, lat: number, lng: number) {
    const { error } = await supabase.rpc("set_pro_location", {
      p_id: proId,
      p_lat: lat,
      p_lng: lng,
    });
    if (error) throw error;
  },

  async setBookingLocation(bookingId: string, lat: number, lng: number) {
    const { error } = await supabase.rpc("set_booking_location", {
      b_id: bookingId,
      p_lat: lat,
      p_lng: lng,
    });
    if (error) throw error;
  },

  /**
   * Live-tracking coords for a matched booking: the patient destination and the
   * matched pro's current origin, both as plain lat/lng (from PostGIS). Either
   * may be null (pro hasn't published a location, or destination not set).
   */
  /** Forward-geocode an address string to coordinates (for the nurse's map). */
  async geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const res = await Location.geocodeAsync(address);
      if (res && res.length > 0) return { lat: res[0].latitude, lng: res[0].longitude };
    } catch {
      // ignore
    }
    return null;
  },

  /** Matched pro's current coords from the public view (deployed; approved pros). */
  async getProCoords(proId: string): Promise<{ lat: number; lng: number } | null> {
    const { data, error } = await supabase
      .from("v_pros_public")
      .select("lat, lng")
      .eq("id", proId)
      .maybeSingle();
    if (error) return null;
    return data?.lat != null && data?.lng != null ? { lat: data.lat, lng: data.lng } : null;
  },

  async getTrackCoords(bookingId: string): Promise<{
    dest: { lat: number; lng: number } | null;
    pro: { lat: number; lng: number } | null;
    proName: string | null;
    proAvatar: string | null;
  }> {
    const { data, error } = await supabase.rpc("get_track_coords", { b_id: bookingId });
    if (error) throw error;
    const row: any = Array.isArray(data) ? data[0] : data;
    return {
      dest: row?.dest_lat != null && row?.dest_lng != null ? { lat: row.dest_lat, lng: row.dest_lng } : null,
      pro: row?.pro_lat != null && row?.pro_lng != null ? { lat: row.pro_lat, lng: row.pro_lng } : null,
      proName: row?.pro_name ?? null,
      proAvatar: row?.pro_avatar ?? null,
    };
  },

  /**
   * Real approved pros with coordinates, nearest first, for plotting on the
   * booking map. Reads the public v_pros_public view and filters/sorts by
   * haversine distance from the patient. Returns [] when none — callers must
   * never fall back to fake people in production.
   */
  async findNearbyProsForMap(
    lat: number,
    lng: number,
    opts?: { specialty?: string; radiusKm?: number; limit?: number }
  ): Promise<NearbyProMapItem[]> {
    const { data, error } = await supabase
      .from("v_pros_public")
      .select("id, full_name, avatar_url, specialty, rating_avg, hourly_rate_mad, lat, lng");
    if (error) throw error;

    const radiusKm = opts?.radiusKm ?? 15;
    const limit = opts?.limit ?? 12;
    return (data ?? [])
      .filter((r: any) => r.lat != null && r.lng != null)
      .filter((r: any) => !opts?.specialty || r.specialty === opts.specialty)
      .map((r: any) => ({ ...r, distanceKm: haversineKm(lat, lng, r.lat, r.lng) }))
      .filter((r: any) => r.distanceKm <= radiusKm)
      .sort((a: any, b: any) => a.distanceKm - b.distanceKm)
      .slice(0, limit) as NearbyProMapItem[];
  },

  async findProsNearBooking(bookingId: string, radiusKm = 15): Promise<NearbyPro[]> {
    const { data, error } = await supabase.rpc("find_pros_within", {
      p_booking_id: bookingId,
      p_radius_km: radiusKm,
    });
    if (error) throw error;
    return (data ?? []) as NearbyPro[];
  },

  async getCurrentPosition(): Promise<{ lat: number; lng: number }> {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      throw new Error("Permission de localisation refusée.");
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      lat: current.coords.latitude,
      lng: current.coords.longitude,
    };
  },

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = places[0];
    if (!place) return null;
    return place.city ?? place.subregion ?? place.region ?? null;
  },

  /** Fuller "street, city" label for the address field (on-device, no network). */
  async reverseGeocodeAddress(lat: number, lng: number): Promise<string | null> {
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const p = places[0];
      if (!p) return null;
      // On Android `p.name` is frequently a Plus Code (e.g. "3X58+Q4P") — never a
      // human address. Skip those (and bare numbers) so we surface a real street.
      const street =
        [p.name, p.street].find((v) => v && !/^\d+$/.test(v) && !isPlusCode(v)) ?? p.street ?? null;
      const city = p.city ?? p.subregion ?? p.region ?? null;
      const label = [street, city].filter(Boolean).join(", ");
      return formatAddress(label) || city || null;
    } catch {
      return null;
    }
  },

  /** Current foreground-location permission status without prompting. */
  async getPermissionStatus(): Promise<"granted" | "denied" | "undetermined"> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return "granted";
    if (status === Location.PermissionStatus.DENIED) return "denied";
    return "undetermined";
  },
};
