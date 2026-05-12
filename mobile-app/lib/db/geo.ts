import * as Location from "expo-location";
import { supabase } from "@/lib/supabase";
import type { NearbyPro } from "./types";

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
};
