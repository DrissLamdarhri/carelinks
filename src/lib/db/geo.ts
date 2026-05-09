/**
 * Geolocation helpers — call PostGIS RPCs defined in /supabase/geo.sql
 */
import { supabase } from "../supabase";

export interface NearbyPro {
  id: string;
  full_name: string | null;
  specialty: string;
  rating_avg: number | null;
  distance_km: number;
}

export const geo = {
  async setProLocation(proId: string, lat: number, lng: number) {
    const { error } = await supabase.rpc("set_pro_location", { p_id: proId, p_lat: lat, p_lng: lng });
    if (error) throw error;
  },

  async setBookingLocation(bookingId: string, lat: number, lng: number) {
    const { error } = await supabase.rpc("set_booking_location", { b_id: bookingId, p_lat: lat, p_lng: lng });
    if (error) throw error;
  },

  async findProsNearBooking(bookingId: string, radiusKm = 15): Promise<NearbyPro[]> {
    const { data, error } = await supabase.rpc("find_pros_within", {
      p_booking_id: bookingId,
      p_radius_km: radiusKm,
    });
    if (error) throw error;
    return (data ?? []) as NearbyPro[];
  },

  /** Browser geolocation — Promise wrapper. */
  getCurrentPosition(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Geolocation not supported"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10_000 }
      );
    });
  },
};
